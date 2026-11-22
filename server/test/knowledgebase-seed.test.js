import assert from 'node:assert/strict';
import { after, beforeEach, mock, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildKnowledgeBaseArticles } from '../src/scripts/knowledgebase-data.js';

const originalApiKey = process.env.HF_TOKEN;
let rows;
let nextId;
let embeddingCalls;
let transactionCalls;
let failEmbeddingAt;
let invalidEmbedding;
let failWriteAt;
let writes;
let retryDepth = 0;
let departments;

function assertRetried() {
  assert.ok(retryDepth > 0, 'Prisma calls must run inside withDbRetry');
}

function repository(records) {
  return {
    async findFirst({ where }) {
      assertRetried();
      const [sourceMatch, titleMatch] = where.OR;
      return records.find((row) => row.source_document === sourceMatch.source_document
        || (row.source_document === null && row.title === titleMatch.title)) ?? null;
    },
    async create({ data }) {
      assertRetried();
      writes += 1;
      if (writes === failWriteAt) throw new Error('Database write failed');
      const row = { kb_id: nextId++, ...data };
      records.push(row);
      return row;
    },
    async update({ where, data }) {
      assertRetried();
      writes += 1;
      if (writes === failWriteAt) throw new Error('Database write failed');
      const row = records.find((entry) => entry.kb_id === where.kb_id);
      assert.ok(row);
      Object.assign(row, data);
      return row;
    },
  };
}

const prisma = {
  department: {
    async findMany({ where }) {
      assertRetried();
      assert.deepEqual(where, { is_active: true });
      return departments;
    },
  },
  async $transaction(callback) {
    assertRetried();
    transactionCalls += 1;
    // Mimic atomic commit/rollback while using no real database connection.
    const transactionRows = structuredClone(rows);
    const result = await callback({ knowledgeBase: repository(transactionRows) });
    rows = transactionRows;
    return result;
  },
};

mock.module(new URL('../src/config/env.js', import.meta.url), { namedExports: {} });
mock.module(new URL('../src/config/prisma.js', import.meta.url), {
  defaultExport: prisma,
  namedExports: {
    async withDbRetry(operation) {
      retryDepth += 1;
      try {
        return await operation();
      } finally {
        retryDepth -= 1;
      }
    },
  },
});
mock.module(new URL('../src/services/ai.service.js', import.meta.url), {
  namedExports: {
    EMBEDDING_DIMENSIONS: 384,
    getAIConfig: () => ({ embeddingModel: 'test-embedding-model' }),
    async generateEmbedding(text, taskType) {
      embeddingCalls.push({ text, taskType });
      if (embeddingCalls.length === failEmbeddingAt) throw new Error('Provider unavailable');
      if (invalidEmbedding) return [1, 2];
      return [1, ...Array(383).fill(0)];
    },
  },
});

const { seedKnowledgeBase } = await import('../src/scripts/seed-knowledgebase.js');

beforeEach((t) => {
  process.env.HF_TOKEN = 'unit-test-only';
  rows = [];
  nextId = 1;
  embeddingCalls = [];
  transactionCalls = 0;
  failEmbeddingAt = null;
  invalidEmbedding = false;
  failWriteAt = null;
  writes = 0;
  departments = [{ name: 'Active Test Department' }];
  t.mock.method(console, 'log', () => {});
});

after(() => {
  if (originalApiKey === undefined) delete process.env.HF_TOKEN;
  else process.env.HF_TOKEN = originalApiKey;
});

test('seeder writes valid model-tagged document vectors and uses active department names', async () => {
  const result = await seedKnowledgeBase();
  assert.equal(result.length, 5);
  assert.equal(rows.length, 5);
  assert.equal(transactionCalls, 1);
  assert.ok(rows[2].content.includes('Active Test Department'));
  for (const row of rows) {
    assert.equal(row.is_active, true);
    assert.equal(row.embedding_model, 'test-embedding-model');
    assert.equal(JSON.parse(row.embedding).length, 384);
    assert.ok(row.source_document.startsWith('platform:'));
  }
  assert.ok(embeddingCalls.every(({ taskType }) => taskType === 'RETRIEVAL_DOCUMENT'));
});

test('rerunning the seeder updates its own records without duplicates or enabling disabled articles', async () => {
  await seedKnowledgeBase();
  const originalIds = rows.map(({ kb_id }) => kb_id);
  rows[0].is_active = false;
  rows[0].content = 'Old seed content';
  rows.push({ kb_id: 100, source_document: 'admin-policy', title: 'Admin policy', content: 'Keep this', is_active: false });
  departments = [{ name: 'Renamed Active Department' }];

  await seedKnowledgeBase();

  assert.equal(rows.length, 6);
  assert.deepEqual(rows.slice(0, 5).map(({ kb_id }) => kb_id), originalIds);
  assert.equal(rows[0].is_active, false);
  assert.ok(rows[2].content.includes('Renamed Active Department'));
  assert.deepEqual(rows[5], { kb_id: 100, source_document: 'admin-policy', title: 'Admin policy', content: 'Keep this', is_active: false });
});

test('legacy title matches are adopted with a stable seed source identity', async () => {
  const article = buildKnowledgeBaseArticles(departments)[0];
  rows.push({ kb_id: 22, title: article.title, source_document: null, is_active: false });
  const result = await seedKnowledgeBase();
  assert.equal(rows.length, 5);
  assert.equal(result[0].kb_id, 22);
  assert.equal(rows[0].source_document, article.source_document);
  assert.equal(rows[0].is_active, false);
});

test('an embedding provider failure aborts before any database writes', async () => {
  const existing = { kb_id: 9, source_document: 'platform:clearance-rules', content: 'Preserve old content', embedding: '[1]', is_active: true };
  rows.push(existing);
  failEmbeddingAt = 3;
  await assert.rejects(seedKnowledgeBase(), /Provider unavailable/);
  assert.equal(embeddingCalls.length, 3);
  assert.equal(transactionCalls, 0);
  assert.equal(writes, 0);
  assert.deepEqual(rows, [existing]);
});

test('wrong-sized embeddings fail ingestion before any database writes', async () => {
  invalidEmbedding = true;
  await assert.rejects(seedKnowledgeBase(), /Invalid 384-dimensional embedding/);
  assert.equal(transactionCalls, 0);
  assert.equal(writes, 0);
});

test('a transactional write failure leaves the existing knowledge base unchanged', async () => {
  rows.push({ kb_id: 40, source_document: 'admin-policy', content: 'Keep this' });
  const before = structuredClone(rows);
  failWriteAt = 3;
  await assert.rejects(seedKnowledgeBase(), /Database write failed/);
  assert.equal(transactionCalls, 1);
  assert.deepEqual(rows, before);
});

test('local seeding needs no HF inference key', async () => {
  delete process.env.HF_TOKEN;
  assert.equal((await seedKnowledgeBase()).length, 5);
  assert.equal(embeddingCalls.length, 5);
});

test('standalone seeder exits unsuccessfully with a sanitized error when the database is unavailable', () => {
  const script = fileURLToPath(new URL('../src/scripts/seed-knowledgebase.js', import.meta.url));
  const result = spawnSync(process.execPath, [script], {
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: 'test',
      TRANSFORMERS_OFFLINE: 'true',
      HF_TOKEN: '',
      DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
    },
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Knowledge base seeding failed/);
  assert.doesNotMatch(result.stderr, /postgresql:\/\/|unit-test-only|Error:|at file:/);
});
