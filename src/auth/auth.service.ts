import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { db } from '../db';
import { signToken } from './token';
import { sendResetEmail, sendVerifyEmail } from '../mail';

@Injectable()
export class AuthService {
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

  private async upgradeHash(userId: number, password: string, stored: string) {
    if (stored.startsWith('$2')) return;
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      await this.hash(password),
      userId,
    ]);
  }

  private async ensureResetTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        used BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
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
      'SELECT id, title, amount, type FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map((row: any) => ({
      id: row.id,
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

  async signup(name: string, email: string, password: string, age?: number, acceptedTerms?: boolean, city?: string) {
    if (!acceptedTerms) throw new BadRequestException('You must accept the terms');
    if (Number(age || 0) < 18) throw new BadRequestException('You must be 18 or older');
    const cleanEmail = email.trim().toLowerCase();
    const exists = await db.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (exists.rows[0]) throw new BadRequestException('This email is already registered');
    const created = await db.query(
      `INSERT INTO users (name, email, password_hash, balance, age, city, terms_accepted_at)
       VALUES ($1, $2, $3, 1, $4, $5, NOW())
       RETURNING *`,
      [name, cleanEmail, await this.hash(password), Number(age), (city || '').trim()],
    );
    const user = created.rows[0];
    await db.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, title)
       VALUES ($1, 'BONUS', 1, 'Starter bonus')`,
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
    if (!userId || !token) return { ok: false, reason: 'missing-user-or-token' };
    await db.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        platform TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.query('ALTER TABLE device_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()');
    await db.query('DELETE FROM device_tokens WHERE token = $1 OR user_id = $2', [token, userId]);
    await db.query(
      `INSERT INTO device_tokens (user_id, token, platform)
       VALUES ($1, $2, $3)`,
      [userId, token, platform || 'android'],
    );
    const count = await db.query('SELECT COUNT(*)::int AS n FROM device_tokens WHERE user_id = $1', [userId]);
    return { ok: true, saved: true, tokens: count.rows[0].n };
  }
  async login(email: string, password: string) {
    const cleanEmail = email.trim().toLowerCase();
    const result = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    const user = result.rows[0];
    if (!user || !(await this.passwordMatches(password, user.password_hash))) {
      throw new UnauthorizedException('Email or password is wrong');
    }
    if (user.is_suspended) throw new UnauthorizedException('Account suspended');
    if (!user.email_verified) throw new UnauthorizedException('Email not verified');
    await this.upgradeHash(user.id, password, user.password_hash);
    await db.query('UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1', [user.id]);
    return {
      token: signToken(user.id),
      user: this.publicUser(user, await this.reviewsOf(user.id), await this.historyOf(user.id)),
    };
  }


  async googleLogin(idToken: string) {
    if (!idToken) throw new UnauthorizedException('Google sign-in failed');
    const res = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
    if (!res.ok) throw new UnauthorizedException('Google token is invalid');
    const payload = await res.json() as { email?: string; email_verified?: string; name?: string; picture?: string };
    const cleanEmail = String(payload.email || '').trim().toLowerCase();
    if (!cleanEmail) throw new UnauthorizedException('Google account has no email');
    if (payload.email_verified !== 'true' && payload.email_verified !== true as any) {
      throw new UnauthorizedException('Google email is not verified');
    }
    let found = await db.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    let user = found.rows[0];
    if (!user) {
      const created = await db.query(
        `INSERT INTO users (name, email, password_hash, balance, age, city, email_verified, terms_accepted_at, photo_url)
         VALUES ($1, $2, $3, 1, 18, '', TRUE, NOW(), $4)
         RETURNING *`,
        [payload.name || cleanEmail.split('@')[0], cleanEmail, await this.hash('google-' + Date.now()), payload.picture || ''],
      );
      user = created.rows[0];
      await db.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, title)
         VALUES ($1, 'BONUS', 1, 'Starter bonus')`,
        [user.id],
      );
    } else {
      if (user.is_suspended) throw new UnauthorizedException('Account suspended');
      await db.query(
        'UPDATE users SET email_verified = TRUE, last_login = NOW(), updated_at = NOW() WHERE id = $1',
        [user.id],
      );
      user.email_verified = true;
    }
    return {
      token: signToken(user.id),
      user: this.publicUser(user, await this.reviewsOf(user.id), await this.historyOf(user.id)),
    };
  }

  async verifyEmail(token: string) {
    const result = await db.query(
      'SELECT * FROM email_verifications WHERE token = $1',
      [token],
    );
    const row = result.rows[0];
    if (!row) throw new UnauthorizedException('Invalid or used link');
    if (!row.used) {
      await db.query('UPDATE email_verifications SET used = TRUE WHERE id = $1', [row.id]);
      await db.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [row.user_id]);
    }
    const user = (await db.query('SELECT * FROM users WHERE id = $1', [row.user_id])).rows[0];
    return {
      ok: true,
      token: signToken(row.user_id),
      user: this.publicUser(user, await this.reviewsOf(user.id), await this.historyOf(user.id)),
    };
  }

  async forgotPassword(email: string) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return { ok: true };
    await this.ensureResetTable();
    const found = await db.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    const user = found.rows[0];
    if (!user) return { ok: true };
    const token = randomBytes(24).toString('hex');
    await db.query(
      `INSERT INTO password_resets (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '2 hours')`,
      [user.id, token],
    );
    await sendResetEmail(cleanEmail, token);
    return { ok: true };
  }

  async resetPassword(token: string, password: string) {
    if (!token || !password || String(password).length < 6) {
      throw new BadRequestException('The new password must have at least 6 characters.');
    }
    await this.ensureResetTable();
    const found = await db.query(
      `SELECT * FROM password_resets
       WHERE token = $1 AND used = FALSE AND expires_at > NOW()`,
      [token],
    );
    const row = found.rows[0];
    if (!row) throw new UnauthorizedException('This reset link is invalid or has expired.');
    await db.query('UPDATE password_resets SET used = TRUE WHERE id = $1', [row.id]);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      await this.hash(password),
      row.user_id,
    ]);
    return { ok: true };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword || String(newPassword).length < 6) {
      throw new BadRequestException('The new password must have at least 6 characters.');
    }
    const result = await db.query('SELECT id, password_hash FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];
    if (!user) throw new BadRequestException('Account not found');
    if (!(await this.passwordMatches(currentPassword, user.password_hash))) {
      throw new BadRequestException('The current password is incorrect.');
    }
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      await this.hash(newPassword),
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
    language?: string;
  }) {
    const age = Number(body.age || 0);
    if (age > 0 && age < 18) {
      throw new BadRequestException('Skill4Handel is only for users 18 and older');
    }
    const language = body.language === 'nl' ? 'nl' : 'en';
    await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(8) DEFAULT 'en'");
    const result = await db.query(
      `UPDATE users
       SET name = $1,
           city = CASE WHEN COALESCE(city, '') = '' THEN $2 ELSE city END,
           offers = $3, needs = $4, gender = $5, age = $6, language = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [body.name, body.city, body.offers, body.needs, body.gender || '', age || null, language, body.id],
    );
    const user = result.rows[0];
    if (!user) throw new UnauthorizedException('User not found');
    return { user: this.publicUser(user, await this.reviewsOf(user.id), await this.historyOf(user.id)) };
  }

  async setPhoto(id: number, photoUrl: string) {
    const value = String(photoUrl || '').trim();
    if (value && value.length > 350000) {
      throw new BadRequestException('Photo is too large. Please choose a smaller image.');
    }
    if (value && !(value.startsWith('http') || value.startsWith('data:image/'))) {
      throw new BadRequestException('Invalid photo.');
    }
    const result = await db.query(
      'UPDATE users SET photo_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [value, id],
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

  async deleteTransaction(userId: number, id: number) {
    if (!userId || !id) throw new BadRequestException('Invalid transaction');
    await db.query('DELETE FROM wallet_transactions WHERE id = $1 AND user_id = $2', [id, userId]);
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