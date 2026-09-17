import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { db } from '../db';
import { signToken } from './token';
import { sendVerifyEmail } from '../mail';

@Injectable()
export class AuthService {
  private hash(password: string) {
    return createHash('sha256').update(password).digest('hex');
  }

  private publicUser(user: any, reviews: any[] = [], history: any[] = []) {
    const rating = reviews.length
      ? Number((reviews.reduce((sum, item) => sum + Number(item.rating), 0) / reviews.length).toFixed(1))
      : Number(user.rating || 0);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      city: user.city || '',
      offers: user.offers || '',
      needs: user.needs || '',
      photoUrl: user.photo_url || '',
      gender: user.gender || '',
      age: Number(user.age || 0),
      balance: Number(user.balance || 0),
      history,
      reviews,
      rating,
      emailVerified: !!user.email_verified,
    };
  }

  private async reviewsOf(userId: number) {
    const result = await db.query(
      'SELECT from_id, from_name, rating, text, skill FROM reviews WHERE to_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map((row: any) => ({
      fromId: row.from_id,
      fromName: row.from_name,
      rating: Number(row.rating),
      text: row.text,
      skill: row.skill,
    }));
  }

  private async historyOf(userId: number) {
    const result = await db.query(
      'SELECT title, amount, type FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map((row: any) => ({
      title: row.title,
      amount: `${Number(row.amount) > 0 ? '+' : ''}${row.amount} S4H`,
    }));
  }

  async me(userId: number) {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) throw new UnauthorizedException('User not found');
    return this.publicUser(user, await this.reviewsOf(user.id), await this.historyOf(user.id));
  }

  async signup(name: string, email: string, password: string, age?: number, acceptedTerms?: boolean) {
    if (!acceptedTerms) throw new BadRequestException('You must accept the terms');
    if (Number(age || 0) < 18) throw new BadRequestException('You must be 18 or older');
    const cleanEmail = email.trim().toLowerCase();
    const exists = await db.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (exists.rows[0]) throw new BadRequestException('This email is already registered');
    const created = await db.query(
      `INSERT INTO users (name, email, password_hash, balance, age, terms_accepted_at)
       VALUES ($1, $2, $3, 20, $4, NOW())
       RETURNING *`,
      [name, cleanEmail, this.hash(password), Number(age)],
    );
    const user = created.rows[0];
    await db.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, title)
       VALUES ($1, 'BONUS', 20, 'Starter bonus')`,
      [user.id],
    );
    const verifyToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await db.query('INSERT INTO email_verifications (user_id, token) VALUES ($1, $2)', [user.id, verifyToken]);
    const verifyUrl = await sendVerifyEmail(cleanEmail, verifyToken);
    return { token: signToken(user.id), user: this.publicUser(user), verifyUrl };
  }


  async resendVerify(email: string) {
    const clean = (email || '').trim().toLowerCase();
    const found = await db.query('SELECT * FROM users WHERE email = $1', [clean]);
    const user = found.rows[0];
    if (!user || user.email_verified) return { ok: true };
    const verifyToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await db.query('INSERT INTO email_verifications (user_id, token) VALUES ($1, $2)', [user.id, verifyToken]);
    const verifyUrl = await sendVerifyEmail(clean, verifyToken);
    return { ok: true, verifyUrl };
  }

  async saveDeviceToken(userId: number, token: string, platform = 'android') {
    if (!userId || !token) return { ok: true };
    await db.query(
      `INSERT INTO device_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)`,
      [userId, token, platform || 'android'],
    );
    return { ok: true };
  }
  async login(email: string, password: string) {
    const cleanEmail = email.trim().toLowerCase();
    const result = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    const user = result.rows[0];
    if (!user || user.password_hash !== this.hash(password)) {
      throw new UnauthorizedException('Email or password is wrong');
    }
    if (user.is_suspended) throw new UnauthorizedException('Account suspended');
    await db.query('UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1', [user.id]);
    return {
      token: signToken(user.id),
      user: this.publicUser(user, await this.reviewsOf(user.id), await this.historyOf(user.id)),
    };
  }

  async verifyEmail(token: string) {
    const result = await db.query(
      'SELECT * FROM email_verifications WHERE token = $1 AND used = FALSE',
      [token],
    );
    const row = result.rows[0];
    if (!row) throw new UnauthorizedException('Invalid or used link');
    await db.query('UPDATE email_verifications SET used = TRUE WHERE id = $1', [row.id]);
    await db.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [row.user_id]);
    return { ok: true };
  }

  async forgotPassword(email: string, password: string) {
    const cleanEmail = email.trim().toLowerCase();
    const result = await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id',
      [this.hash(password), cleanEmail],
    );
    if (!result.rows[0]) throw new UnauthorizedException('No account found with this email');
    return { ok: true };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword || String(newPassword).length < 6) {
      throw new BadRequestException('The new password must have at least 6 characters.');
    }
    const result = await db.query('SELECT id, password_hash FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) throw new BadRequestException('Account not found');
    if (user.password_hash !== this.hash(currentPassword)) {
      throw new BadRequestException('The current password is incorrect.');
    }
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      this.hash(newPassword),
      userId,
    ]);
    return { ok: true };
  }

  async updateProfile(body: {
    id: number;
    name: string;
    city: string;
    offers: string;
    needs: string;
    gender?: string;
    age?: number;
  }) {
    const age = Number(body.age || 0);
    if (age > 0 && age < 18) {
      throw new BadRequestException('Skill4Handel is only for users 18 and older');
    }
    const result = await db.query(
      `UPDATE users
       SET name = $1, city = $2, offers = $3, needs = $4, gender = $5, age = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [body.name, body.city, body.offers, body.needs, body.gender || '', age || null, body.id],
    );
    const user = result.rows[0];
    if (!user) throw new UnauthorizedException('User not found');
    return { user: this.publicUser(user, await this.reviewsOf(user.id), await this.historyOf(user.id)) };
  }

  async setPhoto(id: number, photoUrl: string) {
    const result = await db.query(
      'UPDATE users SET photo_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [photoUrl, id],
    );
    const user = result.rows[0];
    if (!user) throw new UnauthorizedException('User not found');
    return { user: this.publicUser(user, await this.reviewsOf(user.id), await this.historyOf(user.id)) };
  }

  async addReview(body: any) {
    if (Number(body.rating) <= 3 && !String(body.text || '').trim()) {
      throw new BadRequestException('A reason is required for 3 stars or less');
    }
    const fromId = Number(body.fromId);
    const toId = Number(body.toId);
    const done = await db.query(
      `SELECT e.id
       FROM exchange_offers e
       JOIN chats c ON c.id = e.chat_id
       WHERE e.status IN ('SETTLED', 'REVIEWED')
         AND (
           (c.user_a_id = $1 AND c.user_b_id = $2)
           OR (c.user_a_id = $2 AND c.user_b_id = $1)
         )
       ORDER BY e.id DESC
       LIMIT 1`,
      [fromId, toId],
    );
    if (!done.rows[0]) {
      throw new BadRequestException('You can review only after both sides complete a skill exchange.');
    }
    const recent = await db.query(
      `SELECT id FROM reviews
       WHERE from_id = $1 AND to_id = $2 AND created_at > NOW() - INTERVAL '24 hours'`,
      [fromId, toId],
    );
    if (recent.rows[0]) {
      throw new BadRequestException('You can review this person once every 24 hours.');
    }
    await db.query(
      `INSERT INTO reviews (from_id, to_id, from_name, rating, text, skill)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fromId, toId, body.fromName, body.rating, body.text || '', body.skill || ''],
    );
    const avg = await db.query('SELECT AVG(rating) AS rating FROM reviews WHERE to_id = $1', [toId]);
    await db.query('UPDATE users SET rating = $1 WHERE id = $2', [
      Number(avg.rows[0].rating || 0).toFixed(1),
      toId,
    ]);
    return this.me(toId);
  }

  async transfer(body: { fromId: number; toId: number; amount: number; title: string }) {
    const amount = Number(body.amount) || 0;
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const fromRes = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [body.fromId]);
      const toRes = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [body.toId]);
      const from = fromRes.rows[0];
      const to = toRes.rows[0];
      if (!from || !to) throw new UnauthorizedException('User not found');
      if (Number(from.balance) < amount) throw new BadRequestException('Not enough tokens');
      await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, body.fromId]);
      await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amount, body.toId]);
      await client.query(
        `INSERT INTO wallet_transactions (user_id, other_user_id, type, amount, title)
         VALUES ($1, $2, 'SPEND', $3, $4)`,
        [body.fromId, body.toId, -amount, body.title],
      );
      await client.query(
        `INSERT INTO wallet_transactions (user_id, other_user_id, type, amount, title)
         VALUES ($1, $2, 'EARN', $3, $4)`,
        [body.toId, body.fromId, amount, body.title],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return { ok: true };
  }

  async addTicket(body: any) {
    await db.query(
      `INSERT INTO tickets (user_id, name, type, other_name, text)
       VALUES ($1, $2, $3, $4, $5)`,
      [body.userId, body.name, body.type || 'support', body.otherName || '', body.text],
    );
    return { ok: true };
  }

  async block(userId: number, otherId: number) {
    if (!userId || !otherId || userId === otherId) throw new BadRequestException('Invalid block');
    await db.query(
      'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, otherId],
    );
    return { ok: true };
  }

  async unblock(userId: number, otherId: number) {
    await db.query('DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2', [userId, otherId]);
    return { ok: true };
  }

  async listBlocks(userId: number) {
    const result = await db.query(
      `SELECT u.id, u.name, u.email
       FROM blocks b
       JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async listUsers(userId = 0) {
    const result = await db.query(
      `SELECT * FROM users
       WHERE is_suspended = FALSE
         AND COALESCE(role, 'user') <> 'admin'
         AND id <> $1
         AND id <> ALL (
           SELECT blocked_id FROM blocks WHERE blocker_id = $1
           UNION
           SELECT blocker_id FROM blocks WHERE blocked_id = $1
         )
       ORDER BY id`,
      [userId],
    );
    const users = [];
    for (const user of result.rows) {
      users.push(this.publicUser(user, await this.reviewsOf(user.id)));
    }
    return users;
  }
}