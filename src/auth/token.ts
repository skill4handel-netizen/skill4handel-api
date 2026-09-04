import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'change-this-to-a-long-random-string';

export function signToken(userId: number) {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: '7d' });
}

export function readToken(token: string) {
  const payload = jwt.verify(token, SECRET) as unknown as { sub: number | string };
  return { sub: Number(payload.sub) };
}