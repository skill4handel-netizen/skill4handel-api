import { UnauthorizedException } from '@nestjs/common';
import { db } from '../db';
import { userIdFromRequest } from './http-user';

export async function requireAdmin(req: any) {
  const userId = userIdFromRequest(req);
  if (!userId) throw new UnauthorizedException('Please log in.');
  const result = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
  const user = result.rows[0];
  if (!user || user.role !== 'admin') {
    throw new UnauthorizedException('Not an admin');
  }
  return userId;
}
