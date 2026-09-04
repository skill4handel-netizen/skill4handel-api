import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { db } from '../db';
import { signToken } from '../auth/token';

@Injectable()
export class AdminService {
  private hash(password: string) {
    return createHash('sha256').update(password).digest('hex');
  }

  async login(email: string, password: string) {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [
      email.trim().toLowerCase(),
    ]);
    const user = result.rows[0];
    if (!user || user.password_hash !== this.hash(password)) {
      throw new UnauthorizedException('Wrong email or password');
    }
    if (user.role !== 'admin') {
      throw new UnauthorizedException('Not an admin');
    }
    return {
      token: signToken(user.id),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async listUsers() {
    const result = await db.query(
      `SELECT id, name, email, city, offers, needs, balance, rating, email_verified, is_suspended, role, created_at
       FROM users
       ORDER BY id DESC`,
    );
    return result.rows;
  }

  async setSuspended(id: number, suspended: boolean) {
    const result = await db.query(
      'UPDATE users SET is_suspended = $1, updated_at = NOW() WHERE id = $2 AND role <> $3 RETURNING id',
      [suspended, id, 'admin'],
    );
    if (!result.rows[0]) throw new UnauthorizedException('User not found or is admin');
    return { ok: true };
  }

  async setRole(id: number, role: string) {
    const allowed = ['user', 'admin'];
    if (!allowed.includes(role)) throw new UnauthorizedException('Invalid role');
    const result = await db.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [role, id],
    );
    if (!result.rows[0]) throw new UnauthorizedException('User not found');
    return { ok: true };
  }

  async setPassword(id: number, password: string) {
    if (!password || password.length < 4) {
      throw new UnauthorizedException('Password too short');
    }
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [this.hash(password), id],
    );
    return { ok: true };
  }

  async listTickets() {
    const result = await db.query(
      `SELECT id, user_id, name, type, other_name, text, status, created_at
       FROM tickets
       ORDER BY id DESC`,
    );
    return result.rows;
  }

  async closeTicket(id: number) {
    const result = await db.query(
      `UPDATE tickets SET status = 'closed' WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!result.rows[0]) throw new UnauthorizedException('Ticket not found');
    return { ok: true };
  }

  async listExchanges() {
    const result = await db.query(
      `SELECT e.id, e.status, e.skill_requested, e.skill_offered, e.pay_with_tokens,
              e.extra_tokens, e.settled, e.created_at, c.user_a_id, c.user_b_id, c.name_a, c.name_b
       FROM exchange_offers e
       JOIN chats c ON c.id = e.chat_id
       ORDER BY e.id DESC
       LIMIT 100`,
    );
    return result.rows;
  }
}