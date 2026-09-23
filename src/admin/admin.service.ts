import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { db } from '../db';
import { signToken } from '../auth/token';

@Injectable()
export class AdminService {
  private sha256(password: string) {
    return createHash('sha256').update(password).digest('hex');
  }

  private async hash(password: string) {
    return bcrypt.hash(password, 10);
  }

  private async passwordMatches(password: string, stored: string) {
    if (!stored) return false;
    if (stored.startsWith('$2')) return bcrypt.compare(password, stored);
    return stored === this.sha256(password);
  }

  async login(email: string, password: string) {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await this.passwordMatches(password, user.password_hash))) {
      throw new UnauthorizedException('Wrong email or password');
    }
    if (user.role !== 'admin') {
      throw new UnauthorizedException('Not an admin');
    }
    if (!user.password_hash.startsWith('$2')) {
      await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
        await this.hash(password),
        user.id,
      ]);
    }
    return {
      token: signToken(user.id),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async stats() {
    const users = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE email_verified = true)::int AS verified,
        COUNT(*) FILTER (WHERE is_suspended = true)::int AS suspended,
        COUNT(*) FILTER (WHERE role = 'admin')::int AS admins
      FROM users
    `);
    const tickets = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IS NULL OR status <> 'closed')::int AS open
      FROM tickets
    `);
    const offers = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('PROPOSED','COUNTERED'))::int AS pending,
        COUNT(*) FILTER (WHERE status = 'ACCEPTED')::int AS accepted,
        COUNT(*) FILTER (WHERE status IN ('SETTLED','REVIEWED'))::int AS completed
      FROM exchange_offers
    `);
    return {
      users: users.rows[0],
      tickets: tickets.rows[0],
      offers: offers.rows[0],
    };
  }

  async listUsers(query = '') {
    const q = query.trim();
    if (!q) {
      const result = await db.query(
        `SELECT id, name, email, city, offers, needs, balance, rating, email_verified,
                is_suspended, role, created_at, last_login, updated_at
         FROM users
         ORDER BY id DESC`,
      );
      return result.rows;
    }
    const result = await db.query(
      `SELECT id, name, email, city, offers, needs, balance, rating, email_verified,
              is_suspended, role, created_at, last_login, updated_at
       FROM users
       WHERE name ILIKE $1 OR email ILIKE $1 OR city ILIKE $1
       ORDER BY id DESC`,
      [`%${q}%`],
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
    let wallet = { rows: [] as any[] };
    try {
      wallet = await db.query(
        `SELECT id, type, amount, title, created_at FROM wallet_transactions WHERE user_id = $1 ORDER BY id DESC LIMIT 10`,
        [id],
      );
    } catch (_) {}
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
    try {
      await db.query('DELETE FROM wallet_transactions WHERE user_id = $1 OR other_user_id = $1', [id]);
    } catch (_) {}
    try {
      await db.query('DELETE FROM device_tokens WHERE user_id = $1', [id]);
    } catch (_) {}
    try {
      await db.query('DELETE FROM blocks WHERE blocker_id = $1 OR blocked_id = $1', [id]);
    } catch (_) {}
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
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      await this.hash(password),
      id,
    ]);
    return { ok: true };
  }

  async verifyUser(id: number) {
    const result = await db.query(
      'UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id],
    );
    if (!result.rows[0]) throw new UnauthorizedException('User not found');
    return { ok: true };
  }

  async adjustWallet(id: number, amount: number, title = 'Admin adjustment') {
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0) {
      throw new BadRequestException('Enter a non-zero amount');
    }
    const user = (await db.query('SELECT id, balance FROM users WHERE id = $1', [id])).rows[0];
    if (!user) throw new UnauthorizedException('User not found');
    const next = Number(user.balance || 0) + value;
    if (next < 0) throw new BadRequestException('Balance cannot go below zero');
    await db.query('UPDATE users SET balance = $1, updated_at = NOW() WHERE id = $2', [next, id]);
    try {
      await db.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, title, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [id, value > 0 ? 'credit' : 'debit', Math.abs(value), title || 'Admin adjustment'],
      );
    } catch (_) {}
    return { ok: true, balance: next };
  }

  async listTickets(status = '') {
    if (status === 'open') {
      const result = await db.query(
        `SELECT id, user_id, name, type, other_name, text, status, created_at
         FROM tickets WHERE status IS NULL OR status <> 'closed' ORDER BY id DESC`,
      );
      return result.rows;
    }
    if (status === 'closed') {
      const result = await db.query(
        `SELECT id, user_id, name, type, other_name, text, status, created_at
         FROM tickets WHERE status = 'closed' ORDER BY id DESC`,
      );
      return result.rows;
    }
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

  async replyTicket(id: number, text: string) {
    const note = String(text || '').trim();
    if (!note) throw new BadRequestException('Reply text is required');
    await db.query(`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS admin_reply TEXT`);
    const current = (await db.query('SELECT text FROM tickets WHERE id = $1', [id])).rows[0];
    if (!current) throw new UnauthorizedException('Ticket not found');
    const stamp = new Date().toISOString();
    const replyLine = `\n\n[Admin ${stamp}]\n${note}`;
    await db.query(
      `UPDATE tickets SET admin_reply = COALESCE(admin_reply, '') || $1, status = 'closed' WHERE id = $2`,
      [replyLine, id],
    );
    return { ok: true };
  }

  async listExchanges(status = '') {
    const filter = status ? 'WHERE e.status = $1' : '';
    const params = status ? [status.toUpperCase()] : [];
    const result = await db.query(
      `SELECT e.id, e.status, e.skill_requested, e.skill_offered, e.pay_with_tokens,
              e.extra_tokens, e.settled, e.created_at, c.user_a_id, c.user_b_id, c.name_a, c.name_b
       FROM exchange_offers e
       JOIN chats c ON c.id = e.chat_id
       ${filter}
       ORDER BY e.id DESC
       LIMIT 150`,
      params,
    );
    return result.rows;
  }

  async cancelExchange(id: number) {
    const offer = (await db.query('SELECT * FROM exchange_offers WHERE id = $1', [id])).rows[0];
    if (!offer) throw new UnauthorizedException('Offer not found');
    if (['SETTLED', 'REVIEWED', 'CANCELLED', 'REJECTED'].includes(offer.status)) {
      throw new BadRequestException('This offer cannot be cancelled');
    }
    await db.query(`UPDATE exchange_offers SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [id]);
    try {
      await db.query(
        `INSERT INTO messages (chat_id, from_id, type, text)
         VALUES ($1, $2, 'text', $3)`,
        [offer.chat_id, offer.proposed_by, 'The offer was cancelled by support. Both members may start a new request.'],
      );
    } catch (_) {}
    return { ok: true };
  }
}
