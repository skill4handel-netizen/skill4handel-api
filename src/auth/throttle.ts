import { HttpException } from '@nestjs/common';

const hits = new Map<string, number[]>();

export function clientKey(req: any) {
  return String(
    req.headers?.['x-forwarded-for'] ||
      req.ip ||
      req.connection?.remoteAddress ||
      'unknown',
  )
    .split(',')[0]
    .trim();
}

export function enforceThrottle(req: any, bucket: string, max: number, windowMs: number) {
  const key = `${bucket}:${clientKey(req)}`;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    throw new HttpException('Too many attempts. Please wait a few minutes.', 429);
  }
  recent.push(now);
  hits.set(key, recent);
}
