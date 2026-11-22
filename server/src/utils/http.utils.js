export function positiveInteger(value, name = 'id', maximum = 2_147_483_647) {
  if (!['string', 'number'].includes(typeof value) || !/^\d+$/.test(String(value))
    || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > maximum) {
    const error = new Error(`${name} must be a positive integer no greater than ${maximum}.`);
    error.status = 400;
    throw error;
  }
  return Number(value);
}

export function pagination(query = {}, defaultLimit = 10) {
  const page = positiveInteger(query.page ?? 1, 'page', 100_000);
  const limit = positiveInteger(query.limit ?? defaultLimit, 'limit', 100);
  return { page, limit, skip: (page - 1) * limit };
}

export function publicError(res, error, fallback) {
  if (error?.status && error.status < 500) {
    return res.status(error.status).json({ success: false, message: error.message, ...(error.code && { code: error.code }) });
  }
  console.error(fallback, { code: error?.code || error?.name || 'UNKNOWN_ERROR' });
  return res.status(500).json({ success: false, message: fallback });
}
