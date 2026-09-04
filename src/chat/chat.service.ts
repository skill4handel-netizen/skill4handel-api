import { BadRequestException, Injectable } from '@nestjs/common';
import { db } from '../db';

@Injectable()
export class ChatService {
  private async pendingSwap(chatId: number) {
    const result = await db.query(
      'SELECT * FROM exchange_offers WHERE chat_id = $1 ORDER BY id DESC LIMIT 1',
      [chatId],
    );
    const offer = result.rows[0];
    if (!offer) return null;
    const statusMap: Record<string, string> = {
      PROPOSED: 'pending',
      COUNTERED: 'pending',
      ACCEPTED: 'accepted',
      REJECTED: 'rejected',
      CANCELLED: 'rejected',
      SETTLED: 'completed',
      REVIEWED: 'completed',
    };
    return {
      skillRequested: offer.skill_requested,
      skillOffered: offer.skill_offered,
      payWithTokens: offer.pay_with_tokens,
      extraTokens: offer.extra_tokens,
      duration: offer.duration,
      level: offer.level,
      mode: offer.mode,
      location: offer.location,
      proposedBy: offer.proposed_by,
      status: statusMap[offer.status] || String(offer.status).toLowerCase(),
      doneBy: offer.done_by || [],
      reviewedBy: offer.reviewed_by || [],
    };
  }

  private async pack(chat: any) {
    const messages = await db.query(
      'SELECT from_id, type, text FROM messages WHERE chat_id = $1 ORDER BY id',
      [chat.id],
    );
    return {
      id: chat.id,
      userA: chat.user_a_id,
      userB: chat.user_b_id,
      nameA: chat.name_a,
      nameB: chat.name_b,
      requesterId: chat.requester_id,
      lastMessage: chat.last_message,
      pendingSwap: await this.pendingSwap(chat.id),
      messages: messages.rows.map((row: any) => ({
        type: row.type,
        fromId: row.from_id,
        text: row.text,
      })),
    };
  }

  private async assertSwapLimit(userA: number, userB: number) {
    const pair = await db.query(
      `SELECT e.status, e.updated_at
       FROM exchange_offers e
       JOIN chats c ON c.id = e.chat_id
       WHERE (c.user_a_id = $1 AND c.user_b_id = $2)
          OR (c.user_a_id = $2 AND c.user_b_id = $1)
       ORDER BY e.id DESC`,
      [userA, userB],
    );

    const lastDone = pair.rows.find((row: any) => ['SETTLED', 'REVIEWED'].includes(row.status));
    if (lastDone) {
      const hours = (Date.now() - new Date(lastDone.updated_at).getTime()) / 36e5;
      if (hours < 24) {
        throw new BadRequestException('You can start another swap with this person after 24 hours.');
      }
    }

    const weekCount = pair.rows.filter((row: any) => {
      if (!['SETTLED', 'REVIEWED'].includes(row.status)) return false;
      const days = (Date.now() - new Date(row.updated_at).getTime()) / 864e5;
      return days <= 7;
    }).length;
    if (weekCount >= 3) {
      throw new BadRequestException('Maximum 3 completed swaps with this person per week.');
    }
  }

  async list(userId: number) {
    const result = await db.query(
      'SELECT * FROM chats WHERE user_a_id = $1 OR user_b_id = $1 ORDER BY updated_at DESC',
      [userId],
    );
    const items = [];
    for (const chat of result.rows) {
      items.push({
        id: chat.id,
        name: chat.user_a_id === userId ? chat.name_b : chat.name_a,
        otherId: chat.user_a_id === userId ? chat.user_b_id : chat.user_a_id,
        last: chat.last_message,
        requesterId: chat.requester_id,
        pendingSwap: await this.pendingSwap(chat.id),
      });
    }
    return items;
  }

  async open(myId: number, myName: string, otherId: number, otherName: string) {
    const found = await db.query(
      `SELECT * FROM chats
       WHERE (user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)`,
      [myId, otherId],
    );
    if (found.rows[0]) return this.pack(found.rows[0]);
    const created = await db.query(
      `INSERT INTO chats (user_a_id, user_b_id, name_a, name_b, requester_id, last_message)
       VALUES ($1, $2, $3, $4, $1, '')
       RETURNING *`,
      [myId, otherId, myName, otherName],
    );
    return this.pack(created.rows[0]);
  }

  async get(id: number) {
    const result = await db.query('SELECT * FROM chats WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    return this.pack(result.rows[0]);
  }

  async send(chatId: number, fromId: number, text: string) {
    await db.query(
      `INSERT INTO messages (chat_id, from_id, type, text) VALUES ($1, $2, 'text', $3)`,
      [chatId, fromId, text],
    );
    await db.query(
      'UPDATE chats SET last_message = $1, updated_at = NOW() WHERE id = $2',
      [text, chatId],
    );
    return this.get(chatId);
  }

  async proposeSwap(chatId: number, userId: number, body: any) {
    const chatRes = await db.query('SELECT * FROM chats WHERE id = $1', [chatId]);
    const chat = chatRes.rows[0];
    if (!chat) throw new BadRequestException('Chat not found');
    const existing = await this.pendingSwap(chatId);
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
    await db.query(
      `INSERT INTO exchange_offers
        (chat_id, proposed_by, skill_requested, skill_offered, pay_with_tokens, extra_tokens, duration, level, mode, location, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PROPOSED')`,
      [
        chatId,
        userId,
        body.skillRequested,
        body.payWithTokens ? '' : body.skillOffered,
        !!body.payWithTokens,
        Number(body.extraTokens) || 0,
        body.duration,
        body.level,
        body.mode,
        body.location || '',
      ],
    );
    await db.query('UPDATE chats SET last_message = $1, updated_at = NOW() WHERE id = $2', [
      'New swap offer',
      chatId,
    ]);
    return this.get(chatId);
  }

  async respondSwap(chatId: number, userId: number, action: 'accepted' | 'rejected') {
    const offerRes = await db.query(
      `SELECT * FROM exchange_offers WHERE chat_id = $1 ORDER BY id DESC LIMIT 1`,
      [chatId],
    );
    const offer = offerRes.rows[0];
    if (!offer || !['PROPOSED', 'COUNTERED'].includes(offer.status)) {
      throw new BadRequestException('No pending offer');
    }
    if (Number(userId) === Number(offer.proposed_by)) {
      throw new BadRequestException('The other person must respond');
    }
    const status = action === 'accepted' ? 'ACCEPTED' : 'REJECTED';
    await db.query(
      `UPDATE exchange_offers SET status = $1, done_by = '{}', reviewed_by = '{}', updated_at = NOW() WHERE id = $2`,
      [status, offer.id],
    );
    await db.query('UPDATE chats SET last_message = $1, updated_at = NOW() WHERE id = $2', [
      action === 'accepted' ? 'Offer accepted' : 'Offer rejected',
      chatId,
    ]);
    return this.get(chatId);
  }

  async cancelSwap(chatId: number, userId: number) {
    const offerRes = await db.query(
      `SELECT * FROM exchange_offers WHERE chat_id = $1 ORDER BY id DESC LIMIT 1`,
      [chatId],
    );
    const offer = offerRes.rows[0];
    if (!offer || !['PROPOSED', 'COUNTERED'].includes(offer.status)) {
      throw new BadRequestException('No pending offer to cancel');
    }
    if (Number(userId) !== Number(offer.proposed_by)) {
      throw new BadRequestException('Only the sender can cancel this offer');
    }
    await db.query(`UPDATE exchange_offers SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [offer.id]);
    await db.query('UPDATE chats SET last_message = $1, updated_at = NOW() WHERE id = $2', [
      'Offer cancelled',
      chatId,
    ]);
    return this.get(chatId);
  }

  async markDone(chatId: number, userId: number) {
    const chatRes = await db.query('SELECT * FROM chats WHERE id = $1', [chatId]);
    const chat = chatRes.rows[0];
    const offerRes = await db.query(
      `SELECT * FROM exchange_offers WHERE chat_id = $1 ORDER BY id DESC LIMIT 1`,
      [chatId],
    );
    const offer = offerRes.rows[0];
    if (!chat || !offer || offer.status !== 'ACCEPTED') {
      throw new BadRequestException('Offer is not accepted yet');
    }

    const doneBy = new Set<number>(offer.done_by || []);
    doneBy.add(Number(userId));
    const both = doneBy.has(Number(chat.user_a_id)) && doneBy.has(Number(chat.user_b_id));

    await db.query(
      `UPDATE exchange_offers
       SET done_by = $1, status = $2, updated_at = NOW()
       WHERE id = $3`,
      [[...doneBy], both ? 'SETTLED' : 'ACCEPTED', offer.id],
    );

    if (both && offer.pay_with_tokens && !offer.settled) {
      const amount = Number(offer.extra_tokens) || 0;
      const fromId = Number(offer.proposed_by);
      const toId =
        fromId === Number(chat.user_a_id) ? Number(chat.user_b_id) : Number(chat.user_a_id);
      if (amount > 0) {
        const client = await db.connect();
        try {
          await client.query('BEGIN');
          const locked = await client.query(
            'SELECT settled FROM exchange_offers WHERE id = $1 FOR UPDATE',
            [offer.id],
          );
          if (!locked.rows[0].settled) {
            const fromRes = await client.query(
              'SELECT balance FROM users WHERE id = $1 FOR UPDATE',
              [fromId],
            );
            if (Number(fromRes.rows[0].balance) < amount) {
              throw new BadRequestException('Not enough tokens');
            }
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
    }

    if (both) {
      await db.query('UPDATE chats SET last_message = $1, updated_at = NOW() WHERE id = $2', [
        'Swap completed',
        chatId,
      ]);
    }
    return this.get(chatId);
  }

  async markReviewed(chatId: number, userId: number) {
    const offerRes = await db.query(
      `SELECT * FROM exchange_offers WHERE chat_id = $1 ORDER BY id DESC LIMIT 1`,
      [chatId],
    );
    const offer = offerRes.rows[0];
    if (!offer) throw new BadRequestException('Chat not found');
    const reviewedBy = new Set<number>(offer.reviewed_by || []);
    reviewedBy.add(Number(userId));
    await db.query('UPDATE exchange_offers SET reviewed_by = $1, updated_at = NOW() WHERE id = $2', [
      [...reviewedBy],
      offer.id,
    ]);
    return this.get(chatId);
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