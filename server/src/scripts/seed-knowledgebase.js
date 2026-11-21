import '../config/env.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import prisma, { withDbRetry } from '../config/prisma.js';
import { generateEmbedding, getAIConfig, EMBEDDING_DIMENSIONS } from '../services/ai.service.js';
import { buildKnowledgeBaseArticles } from './knowledgebase-data.js';

/**
 * Prepare all embeddings before writing. A failed local inference never replaces
 * valid content with a missing or stale embedding. Existing disabled seed
 * articles stay disabled; records added by administrators are left alone.
 */
export async function seedKnowledgeBase() {
  const { embeddingModel } = getAIConfig();

  const activeDepartments = await withDbRetry(() =>
    prisma.department.findMany({
      where: { is_active: true },
      select: { name: true },
      orderBy: { department_id: 'asc' },
    })
  );
  const articles = buildKnowledgeBaseArticles(activeDepartments);
  const prepared = [];

  console.log(`Preparing ${articles.length} knowledge base articles using ${embeddingModel}.`);
  for (const article of articles) {
    console.log(`Embedding: ${article.title}`);
    const vector = await generateEmbedding(
      `${article.title}\nCategory: ${article.category}\n\n${article.content}`,
      'RETRIEVAL_DOCUMENT'
    );
    if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS || !vector.every(Number.isFinite)) {
      throw new Error(`Invalid ${EMBEDDING_DIMENSIONS}-dimensional embedding returned for "${article.title}".`);
    }
    prepared.push({ ...article, embedding: JSON.stringify(vector), embedding_model: embeddingModel });
  }

  const records = await withDbRetry(() =>
    prisma.$transaction(async (tx) => {
      const saved = [];
      for (const article of prepared) {
        const existing = await withDbRetry(() =>
          tx.knowledgeBase.findFirst({
            where: {
              OR: [
                { source_document: article.source_document },
                { source_document: null, title: article.title },
              ],
            },
            orderBy: { kb_id: 'asc' },
          })
        );
        const record = existing
          ? await withDbRetry(() =>
              tx.knowledgeBase.update({ where: { kb_id: existing.kb_id }, data: article })
            )
          : await withDbRetry(() =>
              tx.knowledgeBase.create({ data: { ...article, is_active: true } })
            );
        saved.push({ kb_id: record.kb_id, title: record.title });
      }
      return saved;
    }, { maxWait: 10000, timeout: 60000 })
  );

  console.log(`Knowledge base seeded successfully: ${records.length} articles, ${EMBEDDING_DIMENSIONS} dimensions each.`);
  return records;
}

const isMainModule = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  try {
    await seedKnowledgeBase();
  } catch (error) {
    // Provider errors can include request URLs; never print a raw API error/key.
    console.error(`Knowledge base seeding failed (${error.code || 'SEED_FAILED'}). Check AI configuration, database migrations, and local model cache.`);
    process.exitCode = 1;
  } finally {
    await withDbRetry(() => prisma.$disconnect());
  }
}
