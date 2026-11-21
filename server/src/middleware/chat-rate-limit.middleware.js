const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const MAX_USERS = 10_000;

// This bounds provider requests and memory in one API process. Multi-instance
// deployments need an equivalent shared-store limiter at the gateway or API.
const users = new Map();
let lastPrunedAt = 0;

function pruneExpired(now) {
  for (const [userId, entry] of users) {
    if (entry.resetAt <= now) users.delete(userId);
  }
  lastPrunedAt = now;
}

export function chatRateLimit(req, res, next) {
  const userId = req.user?.user_id;
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(401).json({
      success: false,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Please log in before sending a chat message.',
    });
  }

  const now = Date.now();
  if (now - lastPrunedAt >= WINDOW_MS || users.size >= MAX_USERS) {
    pruneExpired(now);
  }

  let entry = users.get(userId);
  if (entry && entry.resetAt <= now) {
    users.delete(userId);
    entry = undefined;
  }

  if (!entry) {
    if (users.size >= MAX_USERS) {
      res.setHeader('Retry-After', '60');
      return res.status(503).json({
        success: false,
        code: 'CHAT_RATE_LIMIT_CAPACITY',
        message: 'Chat is temporarily busy. Please try again in a minute.',
      });
    }
    entry = { count: 0, resetAt: now + WINDOW_MS };
    users.set(userId, entry);
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      success: false,
      code: 'CHAT_RATE_LIMITED',
      message: 'Chat request limit reached. Please try again shortly.',
    });
  }

  entry.count += 1;
  return next();
}
