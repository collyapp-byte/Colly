export const rateLimitMap = new Map<
  string,
  { count: number; resetTime: number }
>();

export function checkRateLimit(
  ip: string,
  limit: number = 10,
  windowMs: number = 60000,
): boolean {
  const now = Date.now();

  // Keep the in-memory map bounded: periodically drop expired records.
  if (rateLimitMap.size > 10000) {
    for (const [key, record] of rateLimitMap) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }

  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}
