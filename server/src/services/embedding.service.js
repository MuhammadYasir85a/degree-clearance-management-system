import '../config/env.js';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AIServiceError } from './ai.errors.js';

export const EMBEDDING_DIMENSIONS = 384;
export const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
// Version the pooling/quantization strategy so retrieval cannot mix older vectors.
export const EMBEDDING_ID = `${EMBEDDING_MODEL}:quantized:mean-v1`;
let pipelinePromise;
let inferenceQueue = Promise.resolve();

async function getExtractor() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      const serverDirectory = fileURLToPath(new URL('../../', import.meta.url));
      env.cacheDir = resolve(serverDirectory, process.env.TRANSFORMERS_CACHE?.trim() || '.cache/transformers');
      env.allowRemoteModels = process.env.TRANSFORMERS_OFFLINE !== 'true';
      return pipeline('feature-extraction', EMBEDDING_MODEL, { quantized: true });
    })().catch(() => {
      // A failed download must not poison the singleton until server restart.
      pipelinePromise = undefined;
      throw new AIServiceError('Local embedding model could not load. Check the model cache and first-run download access.', 503, 'EMBEDDING_MODEL_UNAVAILABLE');
    });
  }
  return pipelinePromise;
}

export function normalizeVector(vector) {
  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS || !vector.every(Number.isFinite)) {
    throw new AIServiceError('The embedding model returned an invalid vector.', 502, 'AI_INVALID_EMBEDDING');
  }
  const norm = Math.hypot(...vector);
  if (!Number.isFinite(norm) || norm === 0) {
    throw new AIServiceError('The embedding model returned an invalid vector.', 502, 'AI_INVALID_EMBEDDING');
  }
  return vector.map((value) => value / norm);
}

// MiniLM has a short input window. Pool bounded chunks so long articles are
// represented beyond their opening lines. Queries use the same strategy.
export function splitEmbeddingText(text) {
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > 512) {
    const boundary = remaining.lastIndexOf(' ', 512);
    const end = boundary > 256 ? boundary : 512;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function generateEmbedding(text, taskType = 'RETRIEVAL_DOCUMENT') {
  if (typeof text !== 'string' || !text.trim() || text.length > 6500) {
    throw new AIServiceError('Embedding text must contain 1 to 6500 characters.', 400, 'INVALID_EMBEDDING_TEXT');
  }
  if (!['RETRIEVAL_DOCUMENT', 'RETRIEVAL_QUERY'].includes(taskType)) {
    throw new AIServiceError('Invalid embedding task type.', 400, 'INVALID_EMBEDDING_TASK');
  }
  const extractor = await getExtractor();
  const run = inferenceQueue.then(async () => {
    try {
      const chunks = splitEmbeddingText(text);
      const mean = Array(EMBEDDING_DIMENSIONS).fill(0);
      for (const chunk of chunks) {
        const output = await extractor(chunk, { pooling: 'mean', normalize: true });
        const vector = normalizeVector(Array.from(output?.data ?? []));
        for (let i = 0; i < mean.length; i += 1) mean[i] += vector[i] / chunks.length;
      }
      return normalizeVector(mean);
    } catch (error) {
      if (error instanceof AIServiceError) throw error;
      throw new AIServiceError('Local embedding inference failed. Please try again later.', 503, 'EMBEDDING_INFERENCE_FAILED');
    }
  });
  // Limit concurrent native inference memory. A failed request does not block
  // subsequent work, and callers still receive the original rejection.
  inferenceQueue = run.catch(() => {});
  return run;
}
