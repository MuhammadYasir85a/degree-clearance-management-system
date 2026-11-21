import '../config/env.js';
import Groq from 'groq-sdk';
import { AIServiceError } from './ai.errors.js';

const FALLBACK_MODELS = [
  'llama-3.3-70b-versatile', 'llama-3.1-8b-instant',
  'gemma2-9b-it', 'mixtral-8x7b-32768',
];
const PREFERRED_DYNAMIC_MODELS = ['openai/gpt-oss-20b', 'openai/gpt-oss-120b'];
let workingModel;

export function getGenerationModel() {
  return process.env.GROQ_MODEL?.trim() || 'llama-3.1-8b-instant';
}

export function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new AIServiceError('AI service is not configured. Contact the system administrator.', 503, 'AI_NOT_CONFIGURED');
  }
  return new Groq({ apiKey, timeout: 20000, maxRetries: 1 });
}

function isUnavailableModel(error) {
  const code = error.error?.code ?? error.code;
  return Number(error.status) === 404 || (Number(error.status) === 400
    && ['model_not_found', 'model_decommissioned'].includes(code));
}

function providerError(error) {
  if (error instanceof AIServiceError) return error;
  // Never expose SDK messages, request URLs, credentials, or student prompts.
  const status = Number(error.status);
  if (status === 401 || status === 403) {
    return new AIServiceError('Groq authentication failed. Check the API key and model permissions.', 503, 'GROQ_AUTH_ERROR');
  }
  if (status === 429) {
    return new AIServiceError('AI request quota reached. Please try again later.', 503, 'AI_QUOTA_EXCEEDED');
  }
  return new AIServiceError('The AI provider is unavailable. Please try again later.', 503, 'AI_PROVIDER_ERROR');
}

function dynamicTextModels(models) {
  // /models also lists transcription, speech and safety classifiers. Only
  // recognized chat model families are eligible; no compound/tool agents.
  return (Array.isArray(models) ? models : [])
    .filter(({ id, active }) => active !== false && typeof id === 'string'
      && !/whisper|orpheus|guard|safeguard|embed|tts|speech|audio|compound/i.test(id)
      && /^(?:openai\/gpt-oss-|(?:meta-llama\/)?llama-|qwen\/qwen|gemma|mixtral|mistral|allam)/i.test(id))
    .map(({ id }) => id)
    .sort((a, b) => {
      const rank = (id) => {
        const index = PREFERRED_DYNAMIC_MODELS.indexOf(id);
        return index === -1 ? PREFERRED_DYNAMIC_MODELS.length : index;
      };
      return rank(a) - rank(b) || a.localeCompare(b);
    });
}

export async function callGroqWithFallback(messages, client = getGroqClient()) {
  const configured = getGenerationModel();
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const cached = workingModel?.apiKey === apiKey && workingModel.configured === configured
    && workingModel.expiresAt > Date.now() ? workingModel.model : null;
  const attempted = new Set();
  // A single deadline covers discovery and all attempts, including SDK retries.
  const signal = AbortSignal.timeout(45000);
  async function attempt(model) {
    if (attempted.has(model)) return null;
    attempted.add(model);
    try {
      const response = await client.chat.completions.create({
        model, messages, temperature: 0.1, max_completion_tokens: 800, top_p: 0.9,
        ...(model.startsWith('openai/gpt-oss-') ? { reasoning_effort: 'low', include_reasoning: false } : {}),
      }, { signal });
      const answer = response.choices?.[0]?.message?.content?.trim();
      if (!answer) throw new AIServiceError('The AI provider could not produce an answer. Please rephrase your question.', 502, 'AI_EMPTY_RESPONSE');
      workingModel = { apiKey, configured, model, expiresAt: Date.now() + 5 * 60 * 1000 };
      return { answer, model };
    } catch (error) {
      if (!isUnavailableModel(error)) throw error;
      if (workingModel?.model === model) workingModel = undefined;
      return null;
    }
  }
  try {
    for (const model of [cached, configured, ...FALLBACK_MODELS].filter(Boolean)) {
      const result = await attempt(model);
      if (result) return result;
    }
    const listed = await client.models.list({ signal });
    for (const model of dynamicTextModels(listed.data).filter((id) => !attempted.has(id)).slice(0, 4)) {
      const result = await attempt(model);
      if (result) return result;
    }
    throw new AIServiceError('No compatible Groq chat model is available for this account. Contact the administrator.', 503, 'GROQ_MODEL_UNAVAILABLE');
  } catch (error) {
    // Authentication, quota, timeout and other provider failures are preserved;
    // they are not reasons to try every model or save a fabricated answer.
    throw providerError(error);
  }
}
