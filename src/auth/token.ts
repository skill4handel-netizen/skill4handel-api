import jwt from 'jsonwebtoken';

function secret() {
  const value = process.env.JWT_SECRET || '';
  const hosted = !!process.env.RENDER || process.env.NODE_ENV === 'production';
  if (hosted && (!value || value === 'change-this-to-a-long-random-string')) {
    throw new Error('Set JWT_SECRET in Render Environment before starting the API.');
  }
  return value || 'dev-only-secret';
}

const SECRET = secret();

export function signToken(userId: number) {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '7d' });
}

export function readToken(token: string) {
  const payload = jwt.verify(token, SECRET) as unknown as { sub: number | string };
  return { sub: Number(payload.sub) };
}
