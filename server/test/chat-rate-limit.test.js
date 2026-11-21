import assert from 'node:assert/strict';
import test from 'node:test';

let moduleNumber = 0;
async function freshLimiter() {
  moduleNumber += 1;
  return (await import(`../src/middleware/chat-rate-limit.middleware.js?test=${moduleNumber}`)).chatRateLimit;
}

function request(limiter, userId) {
  const result = { nextCalls: 0, headers: {} };
  const response = {
    setHeader(name, value) { result.headers[name] = value; },
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
  };
  limiter(userId === undefined ? {} : { user: { user_id: userId } }, response, () => { result.nextCalls += 1; });
  return result;
}

test('chat limiter requires the authenticated user identity', async () => {
  const limiter = await freshLimiter();
  for (const identity of [undefined, '1', 0, -1, NaN]) {
    const result = request(limiter, identity);
    assert.equal(result.status, 401);
    assert.equal(result.nextCalls, 0);
    assert.equal(result.body.success, false);
  }
});

test('chat limiter allows ten attempts per user and returns a reset interval', async (t) => {
  let now = 1_000_000;
  t.mock.method(Date, 'now', () => now);
  const limiter = await freshLimiter();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    assert.equal(request(limiter, 1).nextCalls, 1);
  }
  const blocked = request(limiter, 1);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.code, 'CHAT_RATE_LIMITED');
  assert.equal(blocked.headers['Retry-After'], '60');
  assert.equal(blocked.nextCalls, 0);
  assert.equal(request(limiter, 2).nextCalls, 1);

  now += 59_500;
  assert.equal(request(limiter, 1).headers['Retry-After'], '1');
  now += 500;
  assert.equal(request(limiter, 1).nextCalls, 1);
});

test('chat limiter bounds its user map and frees expired capacity', async (t) => {
  let now = 2_000_000;
  t.mock.method(Date, 'now', () => now);
  const limiter = await freshLimiter();
  for (let userId = 1; userId <= 10_000; userId += 1) {
    assert.equal(request(limiter, userId).nextCalls, 1);
  }
  const overflow = request(limiter, 10_001);
  assert.equal(overflow.status, 503);
  assert.equal(overflow.body.code, 'CHAT_RATE_LIMIT_CAPACITY');
  assert.equal(overflow.headers['Retry-After'], '60');
  assert.equal(overflow.nextCalls, 0);
  // Existing users keep their own quota even while the map is at capacity.
  assert.equal(request(limiter, 1).nextCalls, 1);

  now += 60_000;
  assert.equal(request(limiter, 10_001).nextCalls, 1);
});
