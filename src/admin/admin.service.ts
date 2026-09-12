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
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
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
      `SELECT id, name, email, city, offers, needs, balance, rating, email_verified,
              is_suspended, role, created_at, last_login, updated_at
       FROM users
       ORDER BY id DESC`,
    );
    return result.rows;
  }

  async getUser(id: number) {
    const user = (await db.query('SELECT * FROM users WHERE id = $1', [id])).rows[0];
    if (!user) throw new UnauthorizedException('User not found');
    const chats = await db.query(
      `SELECT id, name_a, name_b, last_message, updated_at
       FROM chats WHERE user_a_id = $1 OR user_b_id = $1
       ORDER BY updated_at DESC LIMIT 10`,
      [id],
    );
    const offers = await db.query(
      `SELECT e.id, e.status, e.skill_requested, e.skill_offered, e.extra_tokens, e.created_at, e.updated_at
       FROM exchange_offers e
       JOIN chats c ON c.id = e.chat_id
       WHERE c.user_a_id = $1 OR c.user_b_id = $1
       ORDER BY e.id DESC LIMIT 15`,
      [id],
    );
    const tickets = await db.query(
      `SELECT id, type, status, text, created_at FROM tickets WHERE user_id = $1 ORDER BY id DESC LIMIT 10`,
      [id],
    );
    const reviews = await db.query(
      `SELECT id, rating, text, created_at FROM reviews WHERE to_id = $1 OR from_id = $1 ORDER BY id DESC LIMIT 10`,
      [id],
    );
    const wallet = await db.query(
      `SELECT id, type, amount, title, created_at FROM wallet_transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 10`,
      [id],
    );
    delete user.password_hash;
    return {
      user: {
        ...user,
        last_login: user.last_login || user.updated_at,
      },
      activity: {
        chats: chats.rows,
        offers: offers.rows,
        tickets: tickets.rows,
        reviews: reviews.rows,
        wallet: wallet.rows,
      },
    };
  }

  async deleteUser(id: number) {
    const user = (await db.query('SELECT id, role FROM users WHERE id = $1', [id])).rows[0];
    if (!user) throw new UnauthorizedException('User not found');
    if (user.role === 'admin') throw new UnauthorizedException('Admin accounts cannot be deleted');
    await db.query('DELETE FROM tickets WHERE user_id = $1', [id]);
    await db.query('DELETE FROM reviews WHERE from_id = $1 OR to_id = $1', [id]);
    await db.query('DELETE FROM wallet_transactions WHERE user_id = $1 OR other_user_id = $1', [id]);
    await db.query('DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1', [id]);
    await db.query(
      `DELETE FROM exchange_offers WHERE chat_id IN (
         SELECT id FROM chats WHERE user_a_id = $1 OR user_b_id = $1
       )`,
      [id],
    );
    await db.query(
      `DELETE FROM messages WHERE chat_id IN (
         SELECT id FROM chats WHERE user_a_id = $1 OR user_b_id = $1
       )`,
      [id],
    );
    await db.query('DELETE FROM chats WHERE user_a_id = $1 OR user_b_id = $1', [id]);
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    return { ok: true };
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
    const result = await db.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id', [role, id]);
    if (!result.rows[0]) throw new UnauthorizedException('User not found');
    return { ok: true };
  }

  async setPassword(id: number, password: string) {
    if (!password || password.length < 4) throw new UnauthorizedException('Password too short');
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [this.hash(password), id]);
    return { ok: true };
  }

  async listTickets() {
    const result = await db.query(
      `SELECT id, user_id, name, type, other_name, text, status, created_at
       FROM tickets ORDER BY id DESC`,
    );
    return result.rows;
  }

  async getTicket(id: number) {
    const result = await db.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (!result.rows[0]) throw new UnauthorizedException('Ticket not found');
    return result.rows[0];
  }

  async closeTicket(id: number) {
    const result = await db.query(`UPDATE tickets SET status = 'closed' WHERE id = $1 RETURNING id`, [id]);
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