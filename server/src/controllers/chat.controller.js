import prisma, { withDbRetry } from '../config/prisma.js';
import { generateEmbedding, generateRAGAnswer, getAIConfig } from '../services/ai.service.js';
import { AIServiceError } from '../services/ai.errors.js';

const MAX_MESSAGE_LENGTH = 4000;
const articleSelection = {
  kb_id: true,
  title: true,
  category: true,
  content: true,
  source_document: true,
  embedding_model: true,
  is_active: true,
  created_at: true,
  updated_at: true,
};

function httpError(status, message, code) {
  return Object.assign(new Error(message), { status, code });
}

function positiveInteger(value, name, maximum = 2147483647) {
  if (
    !['string', 'number'].includes(typeof value) ||
    !/^\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1 ||
    Number(value) > maximum
  ) {
    throw httpError(400, `${name} must be a positive integer no greater than ${maximum}.`);
  }
  return Number(value);
}

function pagination(query = {}) {
  const page = positiveInteger(query.page ?? 1, 'page', 100000);
  const limit = positiveInteger(query.limit ?? 20, 'limit', 100);
  return { page, limit, skip: (page - 1) * limit };
}

function textField(value, name, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw httpError(400, `${name} must be a non-empty string of at most ${maxLength} characters.`);
  }
  return value.trim();
}

function articleInput(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'A JSON object is required.');
  }
  const data = {};
  for (const [field, maxLength] of [['title', 200], ['category', 50], ['content', 6000]]) {
    if (!partial || body[field] !== undefined) data[field] = textField(body[field], field, maxLength);
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') throw httpError(400, 'is_active must be a boolean.');
    data.is_active = body.is_active;
  }
  if (body.source_document !== undefined) {
    data.source_document = body.source_document === null
      ? null
      : textField(body.source_document, 'source_document', 200);
  }
  if (partial && Object.keys(data).length === 0) throw httpError(400, 'Provide at least one article field to update.');
  return data;
}

function embeddingText(article) {
  return `${article.title}\nCategory: ${article.category}\n\n${article.content}`;
}

function respondWithError(res, error, fallback) {
  if (error instanceof AIServiceError) {
    return res.status(error.status || 503).json({
      success: false,
      message: error.message,
      code: error.code || 'AI_UNAVAILABLE',
    });
  }
  if (error.status && error.status < 500) {
    return res.status(error.status).json({ success: false, message: error.message, ...(error.code && { code: error.code }) });
  }
  if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Record not found.' });
  console.error(fallback, { code: error.code || error.name });
  return res.status(500).json({ success: false, message: fallback });
}

// POST /api/chat/message. Live context always belongs to the authenticated student.
export async function sendMessage(req, res) {
  try {
    const message = textField(req.body?.message, 'message', MAX_MESSAGE_LENGTH);
    const userId = req.user.user_id;
    const sessionId = req.body.session_id === undefined
      ? null
      : positiveInteger(req.body.session_id, 'session_id');
    let session;
    let previousMessages = [];

    if (sessionId !== null) {
      session = await withDbRetry(() => prisma.chatSession.findFirst({
        where: { session_id: sessionId, user_id: userId },
      }));
      if (!session) throw httpError(404, 'Chat session not found.');
      if (session.ended_at) throw httpError(409, 'This chat session has ended. Start a new conversation.');
      previousMessages = await withDbRetry(() => prisma.chatMessage.findMany({
        where: { session_id: sessionId },
        orderBy: { message_id: 'desc' },
        take: 8,
        select: { role: true, content: true },
      }));
      previousMessages.reverse();
    }

    const result = await generateRAGAnswer({
      userMessage: message,
      userId: req.user.role === 'student' ? userId : null,
      chatHistory: previousMessages,
    });

    // Network generation happens before the transaction. A failed provider call
    // therefore leaves neither an empty session nor an unanswered user message.
    const saved = await withDbRetry(() => prisma.$transaction(async (tx) => {
      if (!session) {
        const created = await withDbRetry(() => tx.chatSession.create({
          data: {
            user_id: userId,
            messages: { create: [{ role: 'user', content: message }, { role: 'assistant', content: result.answer }] },
          },
          include: { messages: { orderBy: { message_id: 'asc' } } },
        }));
        return { sessionId: created.session_id, assistant: created.messages[1] };
      }

      // A concurrent message or deletion invalidates the history used to answer.
      // Check and claim the session atomically instead of interleaving two turns.
      const claimed = await withDbRetry(() => tx.chatSession.updateMany({
        where: { session_id: sessionId, user_id: userId, ended_at: null, updated_at: session.updated_at },
        data: { updated_at: new Date(Math.max(Date.now(), session.updated_at.getTime() + 1)) },
      }));
      if (claimed.count !== 1) throw httpError(409, 'This conversation changed while answering. Reload it and try again.', 'CHAT_CONFLICT');
      await withDbRetry(() => tx.chatMessage.create({
        data: { session_id: sessionId, role: 'user', content: message },
      }));
      const assistant = await withDbRetry(() => tx.chatMessage.create({
        data: { session_id: sessionId, role: 'assistant', content: result.answer },
      }));
      return { sessionId, assistant };
    }));

    return res.status(200).json({
      success: true,
      data: {
        session_id: saved.sessionId,
        message_id: saved.assistant.message_id,
        role: 'assistant',
        content: saved.assistant.content,
        sources: result.sources,
        ...(result.model && { model: result.model }),
        ...(result.guardrail && { guardrail: result.guardrail }),
        created_at: saved.assistant.created_at,
      },
    });
  } catch (error) {
    return respondWithError(res, error, 'Failed to process AI chat message.');
  }
}

// Runs semantic retrieval and generation without persisting an administrator chat.
export async function adminTestRag(req, res) {
  try {
    const message = textField(req.body?.message, 'message', MAX_MESSAGE_LENGTH);
    const result = await generateRAGAnswer({ userMessage: message });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return respondWithError(res, error, 'Failed to run the RAG simulator.');
  }
}

// GET /api/chat/sessions?page=1&limit=20
export async function getSessions(req, res) {
  try {
    const { page, limit, skip } = pagination(req.query);
    const where = { user_id: req.user.user_id };
    const [total, sessions] = await withDbRetry(() => prisma.$transaction(async (tx) => {
      const total = await withDbRetry(() => tx.chatSession.count({ where }));
      const sessions = await withDbRetry(() => tx.chatSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ updated_at: 'desc' }, { session_id: 'desc' }],
        include: { messages: { orderBy: { message_id: 'desc' }, take: 1, select: { content: true } } },
      }));
      return [total, sessions];
    }));
    return res.status(200).json({
      success: true,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      data: sessions.map((item) => ({
        session_id: item.session_id,
        created_at: item.started_at,
        updated_at: item.updated_at,
        ended_at: item.ended_at,
        last_message: item.messages[0]?.content || null,
      })),
    });
  } catch (error) {
    return respondWithError(res, error, 'Failed to retrieve chat sessions.');
  }
}

// GET /api/chat/sessions/:session_id?page=1&limit=20
export async function getSessionMessages(req, res) {
  try {
    const sessionId = positiveInteger(req.params.session_id, 'session_id');
    const { page, limit, skip } = pagination(req.query);
    const session = await withDbRetry(() => prisma.chatSession.findFirst({
      where: { session_id: sessionId, user_id: req.user.user_id },
      include: {
        messages: { orderBy: { message_id: 'asc' }, skip, take: limit },
        _count: { select: { messages: true } },
      },
    }));
    if (!session) throw httpError(404, 'Chat session not found.');
    return res.status(200).json({
      success: true,
      pagination: { page, limit, total: session._count.messages, totalPages: Math.ceil(session._count.messages / limit) },
      data: {
        session_id: session.session_id,
        created_at: session.started_at,
        updated_at: session.updated_at,
        ended_at: session.ended_at,
        messages: session.messages,
      },
    });
  } catch (error) {
    return respondWithError(res, error, 'Failed to retrieve session messages.');
  }
}

// DELETE /api/chat/sessions/:session_id. The existing FK cascades messages.
export async function deleteSession(req, res) {
  try {
    const sessionId = positiveInteger(req.params.session_id, 'session_id');
    const deleted = await withDbRetry(() => prisma.chatSession.deleteMany({
      where: { session_id: sessionId, user_id: req.user.user_id },
    }));
    if (deleted.count !== 1) throw httpError(404, 'Chat session not found.');
    return res.status(200).json({ success: true, message: 'Chat session deleted successfully.' });
  } catch (error) {
    return respondWithError(res, error, 'Failed to delete chat session.');
  }
}

// POST /api/chat/admin/kb. Do not store an unsearchable article on AI failure.
export async function adminCreateKB(req, res) {
  try {
    const data = articleInput(req.body);
    const vector = await generateEmbedding(embeddingText(data), 'RETRIEVAL_DOCUMENT');
    const article = await withDbRetry(() => prisma.knowledgeBase.create({
      data: { ...data, embedding: JSON.stringify(vector), embedding_model: getAIConfig().embeddingModel },
      select: articleSelection,
    }));
    return res.status(201).json({ success: true, message: 'Knowledge base article created and embedded.', data: article });
  } catch (error) {
    return respondWithError(res, error, 'Failed to create knowledge base article.');
  }
}

// GET /api/chat/admin/kb?page=1&limit=20&is_active=true&category=degree_process
export async function adminListKB(req, res) {
  try {
    const { page, limit, skip } = pagination(req.query);
    const where = {};
    if (req.query.is_active !== undefined) {
      if (!['true', 'false'].includes(req.query.is_active)) throw httpError(400, 'is_active must be true or false.');
      where.is_active = req.query.is_active === 'true';
    }
    if (req.query.category !== undefined) where.category = textField(req.query.category, 'category', 50);
    const [total, articles] = await withDbRetry(() => prisma.$transaction(async (tx) => {
      const total = await withDbRetry(() => tx.knowledgeBase.count({ where }));
      const articles = await withDbRetry(() => tx.knowledgeBase.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ updated_at: 'desc' }, { kb_id: 'desc' }],
        select: articleSelection,
      }));
      return [total, articles];
    }));
    return res.status(200).json({
      success: true,
      count: articles.length,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      data: articles,
    });
  } catch (error) {
    return respondWithError(res, error, 'Failed to retrieve knowledge base articles.');
  }
}

// PUT /api/chat/admin/kb/:kb_id. Content and its embedding change together.
export async function adminUpdateKB(req, res) {
  try {
    const kbId = positiveInteger(req.params.kb_id, 'kb_id');
    const data = articleInput(req.body, true);
    const existing = await withDbRetry(() => prisma.knowledgeBase.findUnique({ where: { kb_id: kbId } }));
    if (!existing) throw httpError(404, 'Knowledge base article not found.');
    const contentChanged = ['title', 'category', 'content'].some((key) => data[key] !== undefined && data[key] !== existing[key]);
    if (contentChanged || (data.is_active === true && (!existing.embedding || existing.embedding_model !== getAIConfig().embeddingModel))) {
      const vector = await generateEmbedding(embeddingText({ ...existing, ...data }), 'RETRIEVAL_DOCUMENT');
      data.embedding = JSON.stringify(vector);
      data.embedding_model = getAIConfig().embeddingModel;
    }
    const article = await withDbRetry(() => prisma.$transaction(async (tx) => {
      const changed = await withDbRetry(() => tx.knowledgeBase.updateMany({
        where: { kb_id: kbId, updated_at: existing.updated_at },
        data: { ...data, updated_at: new Date(Math.max(Date.now(), existing.updated_at.getTime() + 1)) },
      }));
      if (changed.count !== 1) throw httpError(409, 'This article changed while updating. Reload it and try again.');
      return withDbRetry(() => tx.knowledgeBase.findUnique({ where: { kb_id: kbId }, select: articleSelection }));
    }));
    return res.status(200).json({ success: true, message: 'Knowledge base article updated.', data: article });
  } catch (error) {
    return respondWithError(res, error, 'Failed to update knowledge base article.');
  }
}

// DELETE /api/chat/admin/kb/:kb_id
export async function adminDeleteKB(req, res) {
  try {
    const kbId = positiveInteger(req.params.kb_id, 'kb_id');
    await withDbRetry(() => prisma.knowledgeBase.delete({ where: { kb_id: kbId } }));
    return res.status(200).json({ success: true, message: 'Knowledge base article deleted successfully.' });
  } catch (error) {
    return respondWithError(res, error, 'Failed to delete knowledge base article.');
  }
}
