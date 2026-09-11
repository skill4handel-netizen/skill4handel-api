import { BadRequestException, Injectable } from '@nestjs/common';
import { db } from '../db';

@Injectable()
export class ChatService {
  private banned(text: string) {
    const value = String(text || '').toLowerCase();
    const words = [
      'sex work',
      'escort',
      'porn',
      'prostitute',
      'weapon',
      'gun',
      'drug deal',
      'cocaine',
      'heroin',
      'hitman',
      'steal to order',
      'fraud service',
    ];
    return words.some((word) => value.includes(word));
  }

  private mapStatus(status: string) {
    const statusMap: Record<string, string> = {
      PROPOSED: 'pending',
      COUNTERED: 'pending',
      ACCEPTED: 'accepted',
      REJECTED: 'rejected',
      CANCELLED: 'cancelled',
      SETTLED: 'completed',
      REVIEWED: 'completed',
    };
    return statusMap[status] || String(status).toLowerCase();
  }

  private async expireOldOffer(offer: any, chat: any) {
    if (!offer || !['PROPOSED', 'COUNTERED'].includes(offer.status)) return offer;
    const start = new Date(offer.created_at || offer.updated_at || 0).getTime();
    if (!start || Date.now() - start < 24 * 60 * 60 * 1000) return offer;
    await db.query(
      `UPDATE exchange_offers SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [offer.id],
    );
    await db.query(
      `INSERT INTO messages (chat_id, from_id, type, text)
       VALUES ($1, 0, 'text', $2)`,
      [chat.id, 'Offer cancelled because there was no response within 24 hours.'],
    );
    await db.query(
      `UPDATE chats SET last_message = $1, last_from_id = 0, updated_at = NOW() WHERE id = $2`,
      ['Offer cancelled: no response in 24 hours', chat.id],
    );
    return { ...offer, status: 'CANCELLED' };
  }

  private packOffer(offer: any, chat: any) {
    if (!offer) return null;
    const requesterId = Number(chat.requester_id);
    const proposedBy = Number(offer.proposed_by);
    return {
      id: offer.id,
      skillRequested: offer.skill_requested,
      skillOffered: offer.skill_offered,
      payWithTokens: offer.pay_with_tokens || Number(offer.extra_tokens) > 0,
      volunteer: String(offer.level || '').toLowerCase() === 'volunteer' ||
        String(offer.skill_offered || '').toLowerCase() === 'volunteer help',
      extraTokens: Number(offer.extra_tokens || 0),
      duration: offer.duration,
      level: offer.level,
      mode: offer.mode,
      location: offer.location,
      scheduledAt: offer.scheduled_at,
      when: offer.scheduled_at,
      proposedBy,
      proposedByName: proposedBy === Number(chat.user_a_id) ? chat.name_a : chat.name_b,
      requesterId,
      requesterName: requesterId === Number(chat.user_a_id) ? chat.name_a : chat.name_b,
      otherName: proposedBy === Number(chat.user_a_id) ? chat.name_b : chat.name_a,
      status: this.mapStatus(offer.status),
      rawStatus: offer.status,
      doneBy: offer.done_by || [],
      reviewedBy: offer.reviewed_by || [],
      createdAt: offer.created_at,
      updatedAt: offer.updated_at,
      cancelReason: offer.status === 'CANCELLED' ? 'No response within 24 hours' : null,
    };
  }

  private async latestOffer(chatId: number) {
    const result = await db.query(
      'SELECT * FROM exchange_offers WHERE chat_id = $1 ORDER BY id DESC LIMIT 1',
      [chatId],
    );
    return result.rows[0] || null;
  }

  private async pendingSwap(chat: any) {
    let offer = await this.latestOffer(chat.id);
    offer = await this.expireOldOffer(offer, chat);
    const packed = this.packOffer(offer, chat);
    if (!packed) return null;
    if (['completed', 'rejected', 'cancelled'].includes(packed.status)) return null;
    return packed;
  }

  private unreadOf(chat: any, userId: number) {
    const lastFrom = Number(chat.last_from_id || 0);
    if (!lastFrom || lastFrom === Number(userId)) return false;
    const lastRead = Number(chat.user_a_id) === Number(userId) ? chat.a_last_read : chat.b_last_read;
    if (!lastRead) return true;
    return new Date(chat.updated_at).getTime() > new Date(lastRead).getTime();
  }

  private async markRead(chat: any, userId: number) {
    if (Number(chat.user_a_id) === Number(userId)) {
      await db.query('UPDATE chats SET a_last_read = NOW() WHERE id = $1', [chat.id]);
    } else if (Number(chat.user_b_id) === Number(userId)) {
      await db.query('UPDATE chats SET b_last_read = NOW() WHERE id = $1', [chat.id]);
    }
  }

  private async pack(chat: any) {
    const messages = await db.query(
      'SELECT from_id, type, text FROM messages WHERE chat_id = $1 ORDER BY id',
      [chat.id],
    );
    const offer = await this.latestOffer(chat.id);
    const expired = await this.expireOldOffer(offer, chat);
    const packed = this.packOffer(expired, chat);
    return {
      id: chat.id,
      userA: chat.user_a_id,
      userB: chat.user_b_id,
      nameA: chat.name_a,
      nameB: chat.name_b,
      requesterId: chat.requester_id,
      lastMessage: chat.last_message,
      pendingSwap: await this.pendingSwap(chat),
      lastCompleted: packed && packed.status === 'completed' ? packed : null,
      messages: messages.rows.map((row: any) => ({
        type: row.type,
        fromId: row.from_id,
        text: row.text,
      })),
    };
  }

  async history(userId: number) {
    const result = await db.query(
      `SELECT e.*, c.user_a_id, c.user_b_id, c.name_a, c.name_b, c.requester_id, c.id AS chat_id
       FROM exchange_offers e
       JOIN chats c ON c.id = e.chat_id
       WHERE (c.user_a_id = $1 OR c.user_b_id = $1)
         AND e.status IN ('SETTLED', 'REVIEWED', 'REJECTED', 'CANCELLED')
       ORDER BY e.updated_at DESC`,
      [userId],
    );
    return result.rows.map((row: any) => ({
      ...this.packOffer(row, row),
      chatId: row.chat_id,
      otherName: Number(row.user_a_id) === userId ? row.name_b : row.name_a,
      otherId: Number(row.user_a_id) === userId ? row.user_b_id : row.user_a_id,
    }));
  }

  async list(userId: number) {
    const result = await db.query(
      `SELECT * FROM chats
       WHERE (user_a_id = $1 OR user_b_id = $1)
         AND NOT EXISTS (
           SELECT 1 FROM blocks
           WHERE (blocker_id = $1 AND blocked_id = CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END)
              OR (blocked_id = $1 AND blocker_id = CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END)
         )
       ORDER BY updated_at DESC`,
      [userId],
    );
    const items = [];
    for (const chat of result.rows) {
      const pending = await this.pendingSwap(chat);
      items.push({
        id: chat.id,
        name: chat.user_a_id === userId ? chat.name_b : chat.name_a,
        otherId: chat.user_a_id === userId ? chat.user_b_id : chat.user_a_id,
        last: chat.last_message,
        requesterId: chat.requester_id,
        unread: this.unreadOf(chat, userId),
        pendingSwap: pending,
        kind: pending?.status === 'pending'
          ? Number(pending.proposedBy) === Number(userId)
            ? 'offer'
            : 'request'
          : pending?.status === 'accepted'
            ? 'session'
            : 'chat',
      });
    }
    return items;
  }

  async open(myId: number, myName: string, otherId: number, otherName: string) {
    const blocked = await db.query(
      `SELECT id FROM blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)`,
      [myId, otherId],
    );
    if (blocked.rows[0]) throw new BadRequestException('This person is blocked');

    const found = await db.query(
      `SELECT * FROM chats
       WHERE (user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)`,
      [myId, otherId],
    );
    const chat = found.rows[0]
      ? found.rows[0]
      : (
          await db.query(
            `INSERT INTO chats (user_a_id, user_b_id, name_a, name_b, requester_id, last_message)
             VALUES ($1, $2, $3, $4, $1, '')
             RETURNING *`,
            [myId, otherId, myName, otherName],
          )
        ).rows[0];
    await this.markRead(chat, myId);
    return this.pack(chat);
  }

  async get(id: number, userId?: number) {
    const result = await db.query('SELECT * FROM chats WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    if (userId) await this.markRead(result.rows[0], userId);
    return this.pack(result.rows[0]);
  }

  async send(chatId: number, fromId: number, text: string) {
    await db.query(`INSERT INTO messages (chat_id, from_id, type, text) VALUES ($1, $2, 'text', $3)`, [
      chatId,
      fromId,
      text,
    ]);
    await db.query(
      'UPDATE chats SET last_message = $1, last_from_id = $2, updated_at = NOW() WHERE id = $3',
      [text, fromId, chatId],
    );
    return this.get(chatId, fromId);
  }

  private async assertSwapLimit(userA: number, userB: number) {
    const pair = await db.query(
      `SELECT e.status, e.updated_at
       FROM exchange_offers e
       JOIN chats c ON c.id = e.chat_id
       WHERE (c.user_a_id = $1 AND c.user_b_id = $2) OR (c.user_a_id = $2 AND c.user_b_id = $1)
       ORDER BY e.id DESC`,
      [userA, userB],
    );
    const lastDone = pair.rows.find((row: any) => ['SETTLED', 'REVIEWED'].includes(row.status));
    if (lastDone) {
      const hours = (Date.now() - new Date(lastDone.updated_at).getTime()) / 36e5;
      if (hours < 24) throw new BadRequestException('You can start another swap with this person after 24 hours.');
    }
    const weekCount = pair.rows.filter((row: any) => {
      if (!['SETTLED', 'REVIEWED'].includes(row.status)) return false;
      return (Date.now() - new Date(row.updated_at).getTime()) / 864e5 <= 7;
    }).length;
    if (weekCount >= 3) throw new BadRequestException('Maximum 3 completed swaps with this person per week.');
  }

  async proposeSwap(chatId: number, userId: number, body: any) {
    const chatRes = await db.query('SELECT * FROM chats WHERE id = $1', [chatId]);
    const chat = chatRes.rows[0];
    if (!chat) throw new BadRequestException('Chat not found');
    if (this.banned(body.skillRequested) || this.banned(body.skillOffered)) {
      throw new BadRequestException('This activity is not allowed on Skill4Handel');
    }
    const scheduledAt = body.scheduledAt || body.when || null;
    if (scheduledAt) {
      const when = new Date(scheduledAt).getTime();
      if (when < Date.now() + 24 * 36e5) {
        throw new BadRequestException('The earliest time is 24 hours from now');
      }
    }
    const existing = await this.pendingSwap(chat);
    if (!existing && Number(userId) !== Number(chat.requester_id)) {
      throw new BadRequestException('Only the requester can send the first offer');
    }
    if (existing && existing.status === 'pending') {
      throw new BadRequestException('There is already a pending offer');
    }
    if (existing && existing.status === 'accepted') {
      throw new BadRequestException('Finish the current swap first');
    }
    await this.assertSwapLimit(chat.user_a_id, chat.user_b_id);
    const tokens = Math.min(10, Math.max(0, Number(body.extraTokens) || 0));
    const isCounter = !!existing;
    await db.query(
      `INSERT INTO exchange_offers
        (chat_id, proposed_by, skill_requested, skill_offered, pay_with_tokens, extra_tokens, duration, level, mode, location, scheduled_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        chatId,
        userId,
        body.skillRequested,
        body.volunteer ? 'Volunteer help' : body.skillOffered,
        tokens > 0,
        tokens,
        body.duration,
        body.volunteer ? 'Volunteer' : body.level,
        body.mode,
        body.location || '',
        scheduledAt,
        isCounter ? 'COUNTERED' : 'PROPOSED',
      ],
    );
    await db.query(
      `INSERT INTO messages (chat_id, from_id, type, text) VALUES ($1, $2, 'text', $3)`,
      [chatId, userId, 'Offer sent. If there is no answer in 24 hours, it will be cancelled.'],
    );
    await db.query(
      'UPDATE chats SET last_message = $1, last_from_id = $2, updated_at = NOW() WHERE id = $3',
      [isCounter ? 'Counter offer' : 'New swap offer', userId, chatId],
    );
    return this.get(chatId, userId);
  }

  async respondSwap(chatId: number, userId: number, action: 'accepted' | 'rejected') {
    const offer = await this.latestOffer(chatId);
    if (!offer || !['PROPOSED', 'COUNTERED'].includes(offer.status)) {
      throw new BadRequestException('No pending offer');
    }
    if (Number(userId) === Number(offer.proposed_by)) {
      throw new BadRequestException('The other person must respond');
    }
    await db.query(
      `UPDATE exchange_offers SET status = $1, done_by = '{}', reviewed_by = '{}', updated_at = NOW() WHERE id = $2`,
      [action === 'accepted' ? 'ACCEPTED' : 'REJECTED', offer.id],
    );
    await db.query(
      'UPDATE chats SET last_message = $1, last_from_id = $2, updated_at = NOW() WHERE id = $3',
      [action === 'accepted' ? 'Offer accepted' : 'Offer rejected', userId, chatId],
    );
    return this.get(chatId, userId);
  }

  async cancelSwap(chatId: number, userId: number) {
    const offer = await this.latestOffer(chatId);
    if (!offer) throw new BadRequestException('No offer to cancel');
    if (['PROPOSED', 'COUNTERED'].includes(offer.status)) {
      if (Number(userId) !== Number(offer.proposed_by)) {
        throw new BadRequestException('Only the sender can cancel this offer');
      }
    } else if (offer.status === 'ACCEPTED') {
      if (!offer.scheduled_at) throw new BadRequestException('No scheduled time on this offer');
      const hours = (new Date(offer.scheduled_at).getTime() - Date.now()) / 36e5;
      if (hours < 24) {
        throw new BadRequestException('Cancel is only allowed until 24 hours before the agreed time');
      }
    } else {
      throw new BadRequestException('This offer cannot be cancelled');
    }
    await db.query(`UPDATE exchange_offers SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [offer.id]);
    await db.query(
      'UPDATE chats SET last_message = $1, last_from_id = $2, updated_at = NOW() WHERE id = $3',
      ['Offer cancelled', userId, chatId],
    );
    return this.get(chatId, userId);
  }

  private isSkillSwap(offer: any) {
    const offered = String(offer.skill_offered || '').toLowerCase();
    const level = String(offer.level || '').toLowerCase();
    if (level === 'volunteer' || offered === 'volunteer help') return false;
    if (offered === 's4h tokens') return false;
    return true;
  }

  async markDone(chatId: number, userId: number) {
    const chatRes = await db.query('SELECT * FROM chats WHERE id = $1', [chatId]);
    const chat = chatRes.rows[0];
    const offer = await this.latestOffer(chatId);
    if (!chat || !offer || offer.status !== 'ACCEPTED') {
      throw new BadRequestException('Offer is not accepted yet');
    }
    if (!offer.scheduled_at) {
      throw new BadRequestException('This offer has no scheduled time');
    }
    if (new Date(offer.scheduled_at).getTime() > Date.now()) {
      throw new BadRequestException('You can mark it done only after the agreed time');
    }
    const doneBy = new Set<number>(offer.done_by || []);
    doneBy.add(Number(userId));
    const both = doneBy.has(Number(chat.user_a_id)) && doneBy.has(Number(chat.user_b_id));
    await db.query(`UPDATE exchange_offers SET done_by = $1, status = $2, updated_at = NOW() WHERE id = $3`, [
      [...doneBy],
      both ? 'SETTLED' : 'ACCEPTED',
      offer.id,
    ]);
    if (both && !offer.settled) {
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const locked = await client.query('SELECT settled FROM exchange_offers WHERE id = $1 FOR UPDATE', [offer.id]);
        if (!locked.rows[0].settled) {
          const amount = Number(offer.extra_tokens || 0);
          if (amount > 0) {
            const fromId = Number(offer.proposed_by);
            const toId = fromId === Number(chat.user_a_id) ? Number(chat.user_b_id) : Number(chat.user_a_id);
            const fromRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [fromId]);
            if (Number(fromRes.rows[0].balance) < amount) throw new BadRequestException('Not enough tokens');
            await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
            await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amount, toId]);
            await client.query(
              `INSERT INTO wallet_transactions (user_id, other_user_id, type, amount, title, exchange_offer_id)
               VALUES ($1,$2,'SPEND',$3,$4,$5)`,
              [fromId, toId, -amount, `Token payment for ${offer.skill_requested}`, offer.id],
            );
            await client.query(
              `INSERT INTO wallet_transactions (user_id, other_user_id, type, amount, title, exchange_offer_id)
               VALUES ($1,$2,'EARN',$3,$4,$5)`,
              [toId, fromId, amount, `Token payment for ${offer.skill_requested}`, offer.id],
            );
          }
          if (this.isSkillSwap(offer)) {
            await client.query('UPDATE users SET balance = balance + 1 WHERE id = $1', [chat.user_a_id]);
            await client.query('UPDATE users SET balance = balance + 1 WHERE id = $2', [chat.user_b_id]);
            await client.query(
              `INSERT INTO wallet_transactions (user_id, type, amount, title, exchange_offer_id)
               VALUES ($1,'BONUS',1,$2,$3)`,
              [chat.user_a_id, `Skill swap bonus for ${offer.skill_requested}`, offer.id],
            );
            await client.query(
              `INSERT INTO wallet_transactions (user_id, type, amount, title, exchange_offer_id)
               VALUES ($1,'BONUS',1,$2,$3)`,
              [chat.user_b_id, `Skill swap bonus for ${offer.skill_requested}`, offer.id],
            );
          }
          await client.query('UPDATE exchange_offers SET settled = TRUE WHERE id = $1', [offer.id]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    if (both) {
      await db.query('UPDATE chats SET last_message = $1, updated_at = NOW() WHERE id = $2', ['Swap completed', chatId]);
    }
    return this.get(chatId, userId);
  }

  async markReviewed(chatId: number, userId: number) {
    const offer = await this.latestOffer(chatId);
    if (!offer) throw new BadRequestException('Chat not found');
    const reviewedBy = new Set<number>(offer.reviewed_by || []);
    reviewedBy.add(Number(userId));
    await db.query('UPDATE exchange_offers SET reviewed_by = $1, updated_at = NOW() WHERE id = $2', [
      [...reviewedBy],
      offer.id,
    ]);
    return this.get(chatId, userId);
  }

  async remove(chatId: number, userId: number) {
    const result = await db.query('SELECT * FROM chats WHERE id = $1', [chatId]);
    const chat = result.rows[0];
    if (!chat) throw new BadRequestException('Chat not found');
    if (Number(userId) !== Number(chat.user_a_id) && Number(userId) !== Number(chat.user_b_id)) {
      throw new BadRequestException('Not in this chat');
    }
    await db.query('DELETE FROM chats WHERE id = $1', [chatId]);
    return { ok: true };
  }
}