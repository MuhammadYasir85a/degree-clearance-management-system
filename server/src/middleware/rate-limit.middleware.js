const stores = new Map();

function prune(store, now) {
  for (const [key, entry] of store) if (entry.resetAt <= now) store.delete(key);
}

export function rateLimit({ name, windowMs, max, key = (req) => req.ip, message }) {
  const store = new Map();
  stores.set(name, store);
  return (req, res, next) => {
    const now = Date.now();
    if (store.size >= 10_000 || Math.random() < 0.01) prune(store, now);
    const identity = String(key(req) || req.ip || 'unknown');
    let entry = store.get(identity);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(identity, entry);
    }
    if (entry.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, code: 'RATE_LIMITED', message });
    }
    entry.count += 1;
    return next();
  };
}

export const authRateLimit = rateLimit({
  name: 'auth', windowMs: 15 * 60_000, max: 30,
  key: (req) => `${req.ip}:${String(req.body?.email || req.body?.registration_no || '').toLowerCase()}`,
  message: 'Too many authentication attempts. Please try again later.',
});

export const loginRateLimit = rateLimit({
  name: 'login', windowMs: 15 * 60_000, max: 10,
  key: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase()}`,
  message: 'Too many login attempts. Please try again later.',
});

export const passwordRecoveryRateLimit = rateLimit({
  name: 'password-recovery', windowMs: 15 * 60_000, max: 6,
  key: (req) => `${req.ip}:${String(req.body?.email || '').trim().toLowerCase()}`,
  message: 'Too many password recovery attempts. Please try again later.',
});
