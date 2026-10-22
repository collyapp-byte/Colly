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
