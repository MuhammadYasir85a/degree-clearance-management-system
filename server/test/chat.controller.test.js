import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';
import { AIServiceError } from '../src/services/ai.errors.js';

// Import boundaries are mocked before loading either controller or routes. No
// environment file, PostgreSQL connection, or Google request is used by tests.
const prisma = {};
let generateAnswer;
let generateVector;
const vector = Array.from({ length: 384 }, (_, index) => index === 0 ? 1 : 0);
const users = {
  student: { user_id: 7, role: 'student', is_active: true },
  other_student: { user_id: 8, role: 'student', is_active: true },
  officer: { user_id: 9, role: 'officer', is_active: true },
  controller: { user_id: 10, role: 'controller', is_active: true },
  admin: { user_id: 11, role: 'admin', is_active: true },
};

mock.module(new URL('../src/config/prisma.js', import.meta.url), {
  defaultExport: prisma,
  namedExports: { withDbRetry: async (operation) => operation() },
});
mock.module(new URL('../src/services/ai.service.js', import.meta.url), {
  namedExports: {
    generateEmbedding: (...args) => generateVector(...args),
    generateRAGAnswer: (...args) => generateAnswer(...args),
    getAIConfig: () => ({ embeddingModel: 'Xenova/all-MiniLM-L6-v2:quantized:mean-v1', generationModel: 'test-generation-model' }),
  },
});
mock.module(new URL('../src/utils/auth.utils.js', import.meta.url), {
  namedExports: {
    verifyToken: (token) => {
      if (!users[token]) throw new Error('Invalid token');
      return { userId: users[token].user_id };
    },
  },
});

const api = await import('../src/controllers/chat.controller.js');
const { default: router } = await import('../src/routes/chat.routes.js');

function request(body = {}, role = 'student') {
  return { body, user: users[role], params: {}, query: {} };
}

function response(onJson = () => {}) {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; onJson(this); return this; },
  };
}

function routeRequest(method, url, token, body = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method, url, body, query: {}, cookies: {},
      headers: token ? { authorization: `Bearer ${token}` } : {},
    };
    router.handle(req, response(resolve), (error) => {
      if (error) reject(error);
      else reject(new Error(`Route did not respond: ${method} ${url}`));
    });
  });
}

function forbiddenQuery() {
  throw new Error('Unexpected database operation');
}

beforeEach(() => {
  generateAnswer = mock.fn(async () => ({ answer: 'A grounded answer.', sources: [{ kb_id: 1 }] }));
  generateVector = mock.fn(async () => vector);
  prisma.$transaction = mock.fn(async (operation) => operation(prisma));
  prisma.user = {
    findUnique: mock.fn(async ({ where }) => Object.values(users).find((user) => user.user_id === where.user_id) || null),
  };
  prisma.chatSession = {
    findFirst: mock.fn(async () => null),
    findMany: mock.fn(async () => []),
    count: mock.fn(async () => 0),
    create: mock.fn(forbiddenQuery),
    updateMany: mock.fn(forbiddenQuery),
    deleteMany: mock.fn(async () => ({ count: 0 })),
  };
  prisma.chatMessage = {
    findMany: mock.fn(async () => []),
    create: mock.fn(forbiddenQuery),
  };
  prisma.knowledgeBase = {
    findUnique: mock.fn(async () => null),
    findMany: mock.fn(async () => []),
    count: mock.fn(async () => 0),
    create: mock.fn(forbiddenQuery),
    updateMany: mock.fn(forbiddenQuery),
    delete: mock.fn(forbiddenQuery),
  };
});

test('rejects missing, malformed, and oversized messages before AI or database calls', async () => {
  for (const message of [undefined, null, '', '   ', {}, [], 'a'.repeat(4001)]) {
    const res = response();
    await api.sendMessage(request({ message }), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(generateAnswer.mock.callCount(), 0);
  assert.equal(prisma.$transaction.mock.callCount(), 0);
});

test('supplied session identifiers must be positive integers', async () => {
  for (const session_id of [0, -1, null, [], '1x', '1.5', '2147483648']) {
    const res = response();
    await api.sendMessage(request({ message: 'Hello', session_id }), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(prisma.chatSession.findFirst.mock.callCount(), 0);
});

test('missing or foreign sessions return 404 rather than creating a conversation', async () => {
  const res = response();
  await api.sendMessage(request({ message: 'Where is my clearance stuck?', session_id: 55 }), res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(prisma.chatSession.findFirst.mock.calls[0].arguments[0].where, { session_id: 55, user_id: 7 });
  assert.equal(generateAnswer.mock.callCount(), 0);
  assert.equal(prisma.chatSession.create.mock.callCount(), 0);
});

test('ended sessions cannot receive another message', async () => {
  prisma.chatSession.findFirst = mock.fn(async () => ({ session_id: 1, ended_at: new Date() }));
  const res = response();
  await api.sendMessage(request({ message: 'Hello', session_id: 1 }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(generateAnswer.mock.callCount(), 0);
});

test('new conversations atomically create the user and assistant pair after generation', async () => {
  const createdAt = new Date('2026-11-17T00:00:00Z');
  prisma.chatSession.create = mock.fn(async () => ({
    session_id: 20,
    messages: [{ message_id: 30, role: 'user' }, { message_id: 31, content: 'A grounded answer.', created_at: createdAt }],
  }));
  const res = response();
  await api.sendMessage(request({ message: '  Which documents are needed?  ' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.session_id, 20);
  assert.equal(res.body.data.message_id, 31);
  assert.deepEqual(res.body.data.sources, [{ kb_id: 1 }]);
  const { data } = prisma.chatSession.create.mock.calls[0].arguments[0];
  assert.equal(data.user_id, 7);
  assert.deepEqual(data.messages.create, [
    { role: 'user', content: 'Which documents are needed?' },
    { role: 'assistant', content: 'A grounded answer.' },
  ]);
  assert.equal(prisma.$transaction.mock.callCount(), 1);
  assert.equal(generateAnswer.mock.calls[0].arguments[0].userId, 7);
});

test('AI failure leaves no empty conversation or partial message', async () => {
  generateAnswer = mock.fn(async () => { throw new AIServiceError('AI service is not configured.', 503, 'AI_NOT_CONFIGURED'); });
  const res = response();
  await api.sendMessage(request({ message: 'Hello' }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'AI_NOT_CONFIGURED');
  assert.equal(prisma.$transaction.mock.callCount(), 0);
  assert.equal(prisma.chatSession.create.mock.callCount(), 0);
  assert.equal(prisma.chatMessage.create.mock.callCount(), 0);
});

test('uses the newest eight history messages in chronological order and omits student context for staff', async () => {
  const updatedAt = new Date('2026-11-17T00:00:00Z');
  prisma.chatSession.findFirst = mock.fn(async () => ({ session_id: 3, updated_at: updatedAt, ended_at: null }));
  prisma.chatSession.updateMany = mock.fn(async () => ({ count: 1 }));
  prisma.chatMessage.findMany = mock.fn(async () => [
    { role: 'assistant', content: 'Newest message' },
    { role: 'user', content: 'Older message' },
  ]);
  prisma.chatMessage.create = mock.fn(async ({ data }) => ({ message_id: 1, ...data }));
  const res = response();
  await api.sendMessage(request({ message: 'Continue', session_id: 3 }, 'admin'), res);
  assert.equal(res.statusCode, 200);
  const historyQuery = prisma.chatMessage.findMany.mock.calls[0].arguments[0];
  assert.equal(historyQuery.take, 8);
  assert.deepEqual(historyQuery.orderBy, { message_id: 'desc' });
  const args = generateAnswer.mock.calls[0].arguments[0];
  assert.equal(args.userId, null);
  assert.equal(args.chatHistory[0].content, 'Older message');
  assert.equal(args.chatHistory[1].content, 'Newest message');
  const claim = prisma.chatSession.updateMany.mock.calls[0].arguments[0];
  assert.deepEqual(claim.where, { session_id: 3, user_id: 11, ended_at: null, updated_at: updatedAt });
  assert.ok(claim.data.updated_at.getTime() > updatedAt.getTime());
  assert.equal(prisma.chatMessage.create.mock.callCount(), 2);
});

test('a concurrent message or deletion invalidates the answer before any messages are persisted', async () => {
  prisma.chatSession.findFirst = mock.fn(async () => ({ session_id: 3, updated_at: new Date(), ended_at: null }));
  prisma.chatSession.updateMany = mock.fn(async () => ({ count: 0 }));
  const res = response();
  await api.sendMessage(request({ message: 'Continue', session_id: 3 }), res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, 'CHAT_CONFLICT');
  assert.equal(prisma.chatMessage.create.mock.callCount(), 0);
});

test('session reads and deletion are owner-scoped and hide foreign sessions', async () => {
  const req = request();
  req.params.session_id = '44';
  let res = response();
  await api.getSessionMessages(req, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(prisma.chatSession.findFirst.mock.calls[0].arguments[0].where, { session_id: 44, user_id: 7 });
  res = response();
  await api.deleteSession(req, res);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(prisma.chatSession.deleteMany.mock.calls[0].arguments[0].where, { session_id: 44, user_id: 7 });
});

test('rejects unbounded pagination and malformed KB filters', async () => {
  for (const query of [{ page: '0' }, { page: '3x' }, { limit: '101' }, { limit: '-1' }]) {
    const req = request();
    req.query = query;
    const res = response();
    await api.getSessions(req, res);
    assert.equal(res.statusCode, 400);
  }
  const req = request();
  req.query.is_active = 'yes';
  const res = response();
  await api.adminListKB(req, res);
  assert.equal(res.statusCode, 400);
});

test('KB creation validates bounded fields and requires an embedding before writing', async () => {
  for (const body of [{}, { title: 'x'.repeat(201), category: 'general', content: 'Policy' }, { title: 'Title', category: 'general', content: 'Policy', is_active: 'true' }]) {
    const res = response();
    await api.adminCreateKB(request(body, 'admin'), res);
    assert.equal(res.statusCode, 400);
  }
  generateVector = mock.fn(async () => { throw new AIServiceError('Provider unavailable'); });
  const res = response();
  await api.adminCreateKB(request({ title: 'Title', category: 'general', content: 'Policy' }, 'admin'), res);
  assert.equal(res.statusCode, 503);
  assert.equal(prisma.knowledgeBase.create.mock.callCount(), 0);
});

test('KB creation saves embedding model metadata but excludes vectors from its response', async () => {
  const article = { kb_id: 2, title: 'Title', category: 'general', content: 'Policy', is_active: true };
  prisma.knowledgeBase.create = mock.fn(async () => article);
  const res = response();
  await api.adminCreateKB(request({ title: 'Title', category: 'general', content: 'Policy' }, 'admin'), res);
  assert.equal(res.statusCode, 201);
  const args = prisma.knowledgeBase.create.mock.calls[0].arguments[0];
  assert.equal(args.data.embedding, JSON.stringify(vector));
  assert.equal(args.data.embedding_model, 'Xenova/all-MiniLM-L6-v2:quantized:mean-v1');
  assert.equal(args.select.embedding, undefined);
  assert.equal(res.body.data.embedding, undefined);
  assert.deepEqual(generateVector.mock.calls[0].arguments, ['Title\nCategory: general\n\nPolicy', 'RETRIEVAL_DOCUMENT']);
});

test('failed KB re-embedding leaves old content and vector untouched', async () => {
  prisma.knowledgeBase.findUnique = mock.fn(async () => ({ kb_id: 1, title: 'Title', category: 'general', content: 'Old policy', updated_at: new Date() }));
  generateVector = mock.fn(async () => { throw new AIServiceError('Provider unavailable'); });
  const req = request({ content: 'New policy' }, 'admin');
  req.params.kb_id = '1';
  const res = response();
  await api.adminUpdateKB(req, res);
  assert.equal(res.statusCode, 503);
  assert.equal(prisma.$transaction.mock.callCount(), 0);
  assert.equal(prisma.knowledgeBase.updateMany.mock.callCount(), 0);
});

test('KB metadata-only disabling needs no generation and concurrent updates return 409', async () => {
  const updatedAt = new Date('2026-11-17T00:00:00Z');
  prisma.knowledgeBase.findUnique = mock.fn(async () => ({ kb_id: 1, title: 'Title', category: 'general', content: 'Policy', updated_at: updatedAt }));
  prisma.knowledgeBase.updateMany = mock.fn(async () => ({ count: 0 }));
  const req = request({ is_active: false }, 'admin');
  req.params.kb_id = '1';
  const res = response();
  await api.adminUpdateKB(req, res);
  assert.equal(res.statusCode, 409);
  assert.equal(generateVector.mock.callCount(), 0);
  const args = prisma.knowledgeBase.updateMany.mock.calls[0].arguments[0];
  assert.equal(args.where.updated_at, updatedAt);
  assert.equal(args.data.is_active, false);
});

test('chat routes require actual authentication middleware and enforce KB roles', async () => {
  let res = await routeRequest('GET', '/sessions');
  assert.equal(res.statusCode, 401);
  res = await routeRequest('GET', '/sessions', 'invalid-token');
  assert.equal(res.statusCode, 401);
  for (const role of ['student', 'officer']) {
    res = await routeRequest('GET', '/admin/kb', role);
    assert.equal(res.statusCode, 403);
  }
  for (const role of ['controller', 'admin']) {
    res = await routeRequest('GET', '/admin/kb', role);
    assert.equal(res.statusCode, 200);
  }
  res = await routeRequest('POST', '/admin/kb', 'controller', { title: 'Title', category: 'general', content: 'Policy' });
  assert.equal(res.statusCode, 403);
});

test('router uses authenticated user identity to scope cross-user session access', async () => {
  const res = await routeRequest('GET', '/sessions/44', 'other_student');
  assert.equal(res.statusCode, 404);
  assert.deepEqual(prisma.chatSession.findFirst.mock.calls[0].arguments[0].where, { session_id: 44, user_id: 8 });
});
