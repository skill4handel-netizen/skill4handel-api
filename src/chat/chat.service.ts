import { BadRequestException, Injectable } from '@nestjs/common';
import { db } from '../db';
import { NotifyService } from '../notify/notify.service';

@Injectable()
export class ChatService {
  constructor(private readonly notify: NotifyService) {}

  private otherId(chat: any, userId: number) {
    return Number(chat.user_a_id) === Number(userId) ? Number(chat.user_b_id) : Number(chat.user_a_id);
  }

  private async langOf(userId: number) {
    try {
      const row = await db.query('SELECT language FROM users WHERE id = $1', [userId]);
      return row.rows[0]?.language === 'nl' ? 'nl' : 'en';
    } catch (_) {
      return 'en';
    }
  }

  private localize(lang: string, title: string, body: string) {
    const table: Record<string, [string, string]> = {
      'New message': ['New message', 'Nieuw bericht'],
      'Offer closed': ['Offer closed', 'Aanbod gesloten'],
      'Offer cancelled': ['Offer cancelled', 'Aanbod geannuleerd'],
      'New offer received': ['New offer received', 'Nieuw aanbod ontvangen'],
      'Counter-offer received': ['Counter-offer received', 'Tegenaanbod ontvangen'],
      'Offer accepted': ['Offer accepted', 'Aanbod geaccepteerd'],
      'Offer declined': ['Offer declined', 'Aanbod afgewezen'],
      'Exchange completed': ['Exchange completed', 'Uitwisseling afgerond'],
      'Completion confirmed': ['Completion confirmed', 'Afronding bevestigd'],
      'An offer expired because the scheduled time passed.': [
        'An offer expired because the scheduled time passed.',
        'Een aanbod is verlopen omdat de geplande tijd voorbij is.',
      ],
      'An offer was cancelled because there was no response within 24 hours.': [
        'An offer was cancelled because there was no response within 24 hours.',
        'Een aanbod is geannuleerd omdat er binnen 24 uur geen reactie kwam.',
      ],
      'A counter-offer is waiting for your response.': [
        'A counter-offer is waiting for your response.',
        'Er wacht een tegenaanbod op uw reactie.',
      ],
      'A skill exchange offer is waiting for your response.': [
        'A skill exchange offer is waiting for your response.',
        'Er wacht een aanbod voor vaardighedenruil op uw reactie.',
      ],
      'Your offer has been accepted.': ['Your offer has been accepted.', 'Uw aanbod is geaccepteerd.'],
      'Your offer has been declined.': ['Your offer has been declined.', 'Uw aanbod is afgewezen.'],
      'An offer was cancelled. A new request may be started.': [
        'An offer was cancelled. A new request may be started.',
        'Een aanbod is geannuleerd. Er kan een nieuw verzoek worden gestart.',
      ],
      'The exchange is complete. Please leave a review.': [
        'The exchange is complete. Please leave a review.',
        'De uitwisseling is afgerond. Laat alstublieft een beoordeling achter.',
      ],
      'The other member has marked the exchange as complete.': [
        'The other member has marked the exchange as complete.',
        'De andere deelnemer heeft de uitwisseling als afgerond gemarkeerd.',
      ],
      'Completion reminder': ['Completion reminder', 'Herinnering afronding'],
      'Review reminder': ['Review reminder', 'Herinnering beoordeling'],
      'Exchange in arbitration': ['Exchange in arbitration', 'Uitwisseling in arbitrage'],
      'Please confirm completion within 72 hours. If you do not respond, the exchange goes to arbitration and tokens will not move until an admin decides.': [
        'Please confirm completion within 72 hours. If you do not respond, the exchange goes to arbitration and tokens will not move until an admin decides.',
        'Bevestig de afronding binnen 72 uur. Als u niet reageert, gaat de uitwisseling naar arbitrage en worden tokens niet verplaatst tot een beheerder beslist.',
      ],
      'Please write your review. New exchanges stay blocked until your review is submitted.': [
        'Please write your review. New exchanges stay blocked until your review is submitted.',
        'Schrijf alstublieft uw beoordeling. Nieuwe uitwisselingen blijven geblokkeerd tot uw beoordeling is ingediend.',
      ],
      'The other member did not confirm completion within 72 hours. This exchange is now in arbitration. Tokens will not move until an admin decides.': [
        'The other member did not confirm completion within 72 hours. This exchange is now in arbitration. Tokens will not move until an admin decides.',
        'De andere deelnemer heeft de afronding niet binnen 72 uur bevestigd. Deze uitwisseling staat nu in arbitrage. Tokens worden niet verplaatst tot een beheerder beslist.',
      ],
    };
    const t = table[title];
    const b = table[body];
    return {
      title: t ? (lang === 'nl' ? t[1] : t[0]) : title,
      body: b ? (lang === 'nl' ? b[1] : b[0]) : body,
    };
  }


  private async ensureOfferColumns() {
    await db.query(`ALTER TABLE exchange_offers ADD COLUMN IF NOT EXISTS pay_with_tokens BOOLEAN DEFAULT FALSE`);
    await db.query(`ALTER TABLE exchange_offers ADD COLUMN IF NOT EXISTS extra_tokens INTEGER DEFAULT 0`);
    await db.query(`ALTER TABLE exchange_offers ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE exchange_offers ADD COLUMN IF NOT EXISTS location VARCHAR(255) DEFAULT ''`);
    await db.query(`ALTER TABLE exchange_offers ADD COLUMN IF NOT EXISTS first_done_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE exchange_offers ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE exchange_offers ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE exchange_offers ADD COLUMN IF NOT EXISTS dispute_ticket_id INTEGER`);
  }

  private async alert(userId: number, title: string, body: string, kind = 'info', refId = 0, otherId = 0, otherName = '') {
    try {
      await db.query(`CREATE TABLE IF NOT EXISTS user_alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title VARCHAR(160) NOT NULL,
        body TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await db.query(`ALTER TABLE user_alerts ADD COLUMN IF NOT EXISTS kind VARCHAR(40) DEFAULT 'info'`);
      await db.query(`ALTER TABLE user_alerts ADD COLUMN IF NOT EXISTS ref_id INTEGER DEFAULT 0`);
      await db.query(`ALTER TABLE user_alerts ADD COLUMN IF NOT EXISTS other_id INTEGER DEFAULT 0`);
      await db.query(`ALTER TABLE user_alerts ADD COLUMN IF NOT EXISTS other_name VARCHAR(120) DEFAULT ''`);
      await db.query(
        'INSERT INTO user_alerts (user_id, title, body, kind, ref_id, other_id, other_name) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [userId, title.slice(0, 160), body, kind, refId || 0, otherId || 0, String(otherName || '').slice(0, 120)],
      );
      await this.ping(userId, title, body, { type: kind });
    } catch (error) {
      console.log('ALERT SKIP', error);
    }
  }

  private async ping(userId: number, title: string, body: string, data: Record<string, string> = {}) {
    try {
      const lang = await this.langOf(userId);
      const loc = this.localize(lang, title, body);
      await this.notify.sendToUser(userId, loc.title, loc.body, data);
    } catch (error) {
      console.log('NOTIFY SKIP', error);
    }
  }

  private banned(text: string) {
    const value = String(text || '').toLowerCase();
    const words = [
      'sex work', 'escort', 'porn', 'prostitute', 'weapon', 'gun',
      'drug deal', 'cocaine', 'heroin', 'hitman', 'steal to order', 'fraud service',
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
      DISPUTED: 'disputed',
    };
    return statusMap[status] || String(status).toLowerCase();
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
      volunteer:
        String(offer.level || '').toLowerCase() === 'volunteer' ||
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
    };
  }

  private async latestOffer(chatId: number) {
    const result = await db.query(
      'SELECT * FROM exchange_offers WHERE chat_id = $1 ORDER BY id DESC LIMIT 1',
      [chatId],
    );
    return result.rows[0] || null;
  }

  private async previousOfferRow(chatId: number) {
    const result = await db.query(
      'SELECT * FROM exchange_offers WHERE chat_id = $1 ORDER BY id DESC LIMIT 2',
      [chatId],
    );
    return result.rows[1] || null;
  }

  private async expireOldOffer(offer: any, chat: any) {
    if (!offer || !chat) return offer;
    const status = String(offer.status || '');
    const start = new Date(offer.created_at || offer.updated_at || 0).getTime();
    const scheduled = offer.scheduled_at ? new Date(offer.scheduled_at).getTime() : 0;
    const noReply = ['PROPOSED', 'COUNTERED'].includes(status) && (!start || Date.now() - start >= 24 * 60 * 60 * 1000);
    const unansweredTimePassed = ['PROPOSED', 'COUNTERED'].includes(status) && !!scheduled && scheduled <= Date.now();
    if (!noReply && !unansweredTimePassed) return offer;
    await db.query(`UPDATE exchange_offers SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [offer.id]);
    const reason = unansweredTimePassed
      ? 'The offer expired because the scheduled time passed without a response. Both members may start a new request.'
      : 'The offer was cancelled automatically because no response was received within 24 hours. Both members may start a new request.';
    try {
      await db.query(`INSERT INTO messages (chat_id, from_id, type, text) VALUES ($1, $2, 'text', $3)`, [
        chat.id,
        offer.proposed_by || chat.user_a_id,
        reason,
      ]);
      await db.query(`UPDATE chats SET last_message = $1, last_from_id = $2, updated_at = NOW() WHERE id = $3`, [
        'Offer closed',
        offer.proposed_by || chat.user_a_id,
        chat.id,
      ]);
    } catch (_) {}
    try {
      await this.alertBoth(chat, 'Offer closed', reason, 'system');
    } catch (_) {}
    return { ...offer, status: 'CANCELLED' };
  }


  private async blockingDuty(userId: number) {
    await this.ensureOfferColumns();
    const row = await db.query(
      `SELECT e.status, c.name_a, c.name_b, c.user_a_id, c.user_b_id
       FROM exchange_offers e
       JOIN chats c ON c.id = e.chat_id
       WHERE (c.user_a_id = $1 OR c.user_b_id = $1)
         AND (
           (e.status = 'ACCEPTED' AND NOT ($1 = ANY(COALESCE(e.done_by, '{}'))))
           OR (e.status = 'SETTLED' AND NOT ($1 = ANY(COALESCE(e.reviewed_by, '{}'))))
           OR e.status = 'DISPUTED'
         )
       ORDER BY e.updated_at DESC
       LIMIT 1`,
      [userId],
    );
    return row.rows[0] || null;
  }

  private async assertNoBlockingDuty(userId: number) {
    const duty = await this.blockingDuty(userId);
    if (!duty) return;
    if (duty.status === 'SETTLED') {
      throw new BadRequestException('Write your pending review before starting or accepting another exchange.');
    }
    if (duty.status === 'DISPUTED') {
      throw new BadRequestException('An exchange is in arbitration. You cannot start or accept another exchange until it is resolved.');
    }
    throw new BadRequestException('Confirm completion and write your review before starting or accepting another exchange.');
  }

  private async postSystem(chatId: number, fromId: number, text: string) {
    try {
      await db.query(`INSERT INTO messages (chat_id, from_id, type, text) VALUES ($1, $2, 'system', $3)`, [chatId, fromId, text]);
      await db.query('UPDATE chats SET last_message = $1, last_from_id = $2, updated_at = NOW() WHERE id = $3', [text.slice(0, 240), fromId, chatId]);
      const chat = (await db.query('SELECT * FROM chats WHERE id = $1', [chatId])).rows[0];
      if (chat) await this.alertBoth(chat, 'System message', text, 'system');
    } catch (_) {}
  }

  private async alertBoth(chat: any, title: string, body: string, kind = 'system') {
    if (!chat) return;
    await this.alert(Number(chat.user_a_id), title, body, kind, chat.id, Number(chat.user_b_id), chat.name_b);
    await this.alert(Number(chat.user_b_id), title, body, kind, chat.id, Number(chat.user_a_id), chat.name_a);
  }

  private async sweepCompletionDuties() {
    await this.ensureOfferColumns();
    const due = await db.query(
      `SELECT e.*, c.user_a_id, c.user_b_id, c.name_a, c.name_b
       FROM exchange_offers e
       JOIN chats c ON c.id = e.chat_id
       WHERE e.status = 'ACCEPTED'
         AND COALESCE(array_length(e.done_by, 1), 0) = 1
         AND e.first_done_at IS NOT NULL
         AND e.first_done_at <= NOW() - INTERVAL '72 hours'`,
    );
    for (const offer of due.rows) {
      const done = Number((offer.done_by || [])[0] || 0);
      const waiting = done === Number(offer.user_a_id) ? Number(offer.user_b_id) : Number(offer.user_a_id);
      const waitingName = waiting === Number(offer.user_a_id) ? offer.name_a : offer.name_b;
      const otherName = waiting === Number(offer.user_a_id) ? offer.name_b : offer.name_a;
      const note = 'The other member did not confirm completion within 72 hours. This exchange is now in arbitration. Tokens will not move until an admin decides.';
      const ticket = await db.query(
        `INSERT INTO tickets (user_id, name, type, other_name, text, status)
         VALUES ($1, $2, 'arbitration', $3, $4, 'open')
         RETURNING id`,
        [waiting, waitingName || 'Member', otherName || 'Member', `${note} Offer #${offer.id}. Skill: ${offer.skill_requested || ''}. Tokens: ${offer.extra_tokens || 0}.`],
      );
      await db.query(
        `UPDATE exchange_offers
         SET status = 'DISPUTED', disputed_at = NOW(), dispute_ticket_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [ticket.rows[0].id, offer.id],
      );
      await this.postSystem(offer.chat_id, done || waiting, note);
      await this.alert(waiting, 'Exchange in arbitration', note, 'offer', offer.chat_id, done, otherName);
      await this.alert(done, 'Exchange in arbitration', note, 'offer', offer.chat_id, waiting, waitingName);
    }

    const reminders = await db.query(
      `SELECT e.*, c.user_a_id, c.user_b_id, c.name_a, c.name_b
       FROM exchange_offers e
       JOIN chats c ON c.id = e.chat_id
       WHERE (
           (e.status = 'ACCEPTED' AND COALESCE(array_length(e.done_by, 1), 0) = 1)
           OR e.status = 'SETTLED'
         )
         AND (e.last_reminder_at IS NULL OR e.last_reminder_at <= NOW() - INTERVAL '8 hours')`,
    );
    for (const offer of reminders.rows) {
      const members = [Number(offer.user_a_id), Number(offer.user_b_id)];
      let sent = false;
      if (offer.status === 'ACCEPTED') {
        const done = new Set((offer.done_by || []).map((value: any) => Number(value)));
        const waiting = members.find((id) => !done.has(id));
        if (waiting) {
          const body = 'Please confirm completion within 72 hours. If you do not respond, the exchange goes to arbitration and tokens will not move until an admin decides.';
          await this.postSystem(offer.chat_id, waiting, body);
          await this.alert(waiting, 'Completion reminder', body, 'offer', offer.chat_id);
          sent = true;
        }
      } else {
        const reviewed = new Set((offer.reviewed_by || []).map((value: any) => Number(value)));
        const body = 'Please write your review. New exchanges stay blocked until your review is submitted.';
        for (const member of members) {
          if (!reviewed.has(member)) {
            await this.postSystem(offer.chat_id, member, body);
            await this.alert(member, 'Review reminder', body, 'review', offer.chat_id, member === Number(offer.user_a_id) ? Number(offer.user_b_id) : Number(offer.user_a_id), member === Number(offer.user_a_id) ? offer.name_b : offer.name_a);
            sent = true;
          }
        }
      }
      if (sent) {
        await db.query('UPDATE exchange_offers SET last_reminder_at = NOW(), updated_at = NOW() WHERE id = $1', [offer.id]);
      }
    }
  }

  private async sweepExpired(userId: number) {
    const result = await db.query(
      `SELECT e.*, c.user_a_id, c.user_b_id, c.id AS chat_id
       FROM exchange_offers e
       JOIN chats c ON c.id = e.chat_id
       WHERE (c.user_a_id = $1 OR c.user_b_id = $1)
         AND e.status IN ('PROPOSED', 'COUNTERED')`,
      [userId],
    );
    for (const row of result.rows) {
      await this.expireOldOffer(row, { id: row.chat_id, user_a_id: row.user_a_id, user_b_id: row.user_b_id });
    }
  }

  private async pendingSwap(chat: any) {
    let offer = await this.latestOffer(chat.id);
    offer = await this.expireOldOffer(offer, chat);
    const packed = this.packOffer(offer, chat);
    if (!packed) return null;
    if (['completed', 'rejected', 'cancelled'].includes(packed.status)) return null;
    const prev = await this.previousOfferRow(chat.id);
    return { ...packed, previous: this.packOffer(prev, chat) };
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
      'SELECT from_id, type, text, created_at FROM messages WHERE chat_id = $1 ORDER BY id',
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
        createdAt: row.created_at,
      })),
    };
  }

  async history(userId: number) {
    const result = await db.query(
      `SELECT e.*, c.user_a_id, c.user_b_id, c.name_a, c.name_b, c.requester_id, c.id AS chat_id
       FROM exchange_offers e
       JOIN chats c ON c.id = e.chat_id
       WHERE (c.user_a_id = $1 OR c.user_b_id = $1)
         AND e.status IN ('ACCEPTED', 'SETTLED', 'REVIEWED', 'REJECTED', 'CANCELLED', 'DISPUTED')
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


  private async reviewPendingFor(chat: any, userId: number) {
    const offer = await this.latestOffer(chat.id);
    if (!offer || offer.status !== 'SETTLED') return false;
    const reviewed = (offer.reviewed_by || []).map((value: any) => Number(value));
    return !reviewed.includes(Number(userId));
  }

  async list(userId: number) {
    await this.sweepExpired(userId);
    await this.sweepCompletionDuties();
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
    const photosRes = await db.query('SELECT id, photo_url FROM users');
    const photos: Record<string, string> = {};
    for (const row of photosRes.rows) photos[String(row.id)] = row.photo_url || '';
    const items = [];
    for (const chat of result.rows) {
      const pending = await this.pendingSwap(chat);
      const otherId = Number(chat.user_a_id) === Number(userId) ? chat.user_b_id : chat.user_a_id;
      items.push({
        id: chat.id,
        name: Number(chat.user_a_id) === Number(userId) ? chat.name_b : chat.name_a,
        otherId,
        last: chat.last_message,
        requesterId: chat.requester_id,
        unread: this.unreadOf(chat, userId),
        waitingForRequester: !pending && Number(chat.requester_id) !== Number(userId),
        photoUrl: photos[String(otherId)] || '',
        pendingSwap: pending,
        reviewPending: await this.reviewPendingFor(chat, userId),
        kind:
          pending?.status === 'pending'
            ? Number(pending.proposedBy) === Number(userId) ? 'offer' : 'request'
            : pending?.status === 'accepted' ? 'session' : 'chat',
      });
    }
    return items;
  }

  async open(myId: number, myName: string, otherId: number, otherName: string) {
    const blocked = await db.query(
      `SELECT id FROM blocks
       WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)`,
      [myId, otherId],
    );
    if (blocked.rows[0]) throw new BadRequestException('This person is blocked');
    const found = await db.query(
      `SELECT * FROM chats
       WHERE (user_a_id = $1 AND user_b_id = $2) OR (user_a_id = $2 AND user_b_id = $1)`,
      [myId, otherId],
    );
    let chat = found.rows[0]
      ? found.rows[0]
      : (
          await db.query(
            `INSERT INTO chats (user_a_id, user_b_id, name_a, name_b, requester_id, last_message)
             VALUES ($1, $2, $3, $4, $1, '') RETURNING *`,
            [myId, otherId, myName, otherName],
          )
        ).rows[0];
    const latest = await this.expireOldOffer(await this.latestOffer(chat.id), chat);
    const openOffer = latest && ['PROPOSED', 'COUNTERED', 'ACCEPTED'].includes(latest.status);
    if (!openOffer) {
      const updated = await db.query(
        `UPDATE chats SET requester_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [myId, chat.id],
      );
      chat = updated.rows[0] || chat;
    }
    await this.markRead(chat, myId);
    return this.pack(chat);
  }

  async get(id: number, userId?: number) {
    const result = await db.query('SELECT * FROM chats WHERE id = $1', [id]);
    if (!result.rows[0]) return null;
    if (userId) await this.sweepExpired(userId);
    if (userId) await this.markRead(result.rows[0], userId);
    return this.pack(result.rows[0]);
  }

  async send(chatId: number, fromId: number, text: string) {
    await db.query(`INSERT INTO messages (chat_id, from_id, type, text) VALUES ($1, $2, 'text', $3)`, [chatId, fromId, text]);
    await db.query('UPDATE chats SET last_message = $1, last_from_id = $2, updated_at = NOW() WHERE id = $3', [text, fromId, chatId]);
    const chat = (await db.query('SELECT * FROM chats WHERE id = $1', [chatId])).rows[0];
    if (chat) {
      await this.ping(this.otherId(chat, fromId), 'New message', text.slice(0, 80), { type: 'chat', chatId: String(chatId) });
    }
    return this.get(chatId, fromId);
  }


  private async tokenState(userId: number) {
    await this.ensureOfferColumns();
    const user = await db.query('SELECT balance FROM users WHERE id = $1', [userId]);
    const reserved = await db.query(
      `SELECT COALESCE(SUM(extra_tokens), 0)::int AS reserved
       FROM exchange_offers
       WHERE proposed_by = $1 AND status IN ('ACCEPTED', 'DISPUTED') AND COALESCE(settled, FALSE) = FALSE`,
      [userId],
    );
    const balance = Number(user.rows[0]?.balance || 0);
    const held = Number(reserved.rows[0]?.reserved || 0);
    return { balance, reserved: held, available: Math.max(0, balance - held) };
  }

  private async assertCanOfferTokens(userId: number, tokens: number) {
    if (tokens <= 0) return;
    const state = await this.tokenState(userId);
    if (tokens > state.available) {
      throw new BadRequestException('You cannot offer more tokens than your available balance.');
    }
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
    if (pair.rows.some((row: any) => row.status === 'ACCEPTED')) {
      throw new BadRequestException('Finish the open session with this person before starting another exchange.');
    }
  }

  async proposeSwap(chatId: number, userId: number, body: any) {
    const chatRes = await db.query('SELECT * FROM chats WHERE id = $1', [chatId]);
    const chat = chatRes.rows[0];
    if (!chat) throw new BadRequestException('Chat not found');
    if (this.banned(body.skillRequested) || this.banned(body.skillOffered)) {
      throw new BadRequestException('This activity is not allowed on Skill4Handel');
    }
    const existing = await this.pendingSwap(chat);
    if (existing && existing.rawStatus === 'COUNTERED') {
      throw new BadRequestException('A second counter-offer is not allowed. Please accept or decline.');
    }
    const scheduledAt = body.scheduledAt || body.when || null;
    if (!existing && scheduledAt) {
      const when = new Date(scheduledAt).getTime();
      if (when < Date.now() + 24 * 36e5) {
        throw new BadRequestException('The earliest time is 24 hours from now');
      }
    }
    if (!existing) {
      await db.query('UPDATE chats SET requester_id = $1 WHERE id = $2', [userId, chatId]);
    }
    if (existing && existing.status === 'accepted') {
      throw new BadRequestException('Finish the current swap first');
    }
    if (!existing) await this.assertSwapLimit(chat.user_a_id, chat.user_b_id);
    await this.assertNoBlockingDuty(userId);
    const tokens = Math.min(10, Math.max(0, Number(body.extraTokens) || 0));
    if (tokens > 0) await this.assertCanOfferTokens(userId, tokens);
    const isCounter = !!existing;
    const requested = String(isCounter ? existing.skillRequested : body.skillRequested || '').slice(0, 250);
    const offered = String(body.volunteer ? '' : body.skillOffered || '').slice(0, 250);
    if ((body.payWithTokens || tokens > 0) && tokens <= 0) {
      throw new BadRequestException('Enter the number of tokens for this exchange');
    }
    await this.ensureOfferColumns();
    try {
    await db.query(
      `INSERT INTO exchange_offers
        (chat_id, proposed_by, skill_requested, skill_offered, pay_with_tokens, extra_tokens, duration, level, mode, location, scheduled_at, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        chatId, userId, requested, offered,
        !!body.payWithTokens || tokens > 0, tokens, String(body.duration || '60').slice(0, 10),
        String(body.volunteer ? 'Volunteer' : body.level || 'basic').slice(0, 20), String(body.mode || 'online').slice(0, 20), String(body.location || '').slice(0, 250),
        scheduledAt, isCounter ? 'COUNTERED' : 'PROPOSED',
      ],
    );
    } catch (error) {
      console.log('OFFER INSERT', error);
      throw new BadRequestException('The offer could not be saved. Check the skill, token amount and time, then try again.');
    }
    const offerText = isCounter ? 'A counter-offer has been sent.' : 'An offer has been sent. If there is no response within 24 hours, it will be cancelled.';
    await db.query(`INSERT INTO messages (chat_id, from_id, type, text) VALUES ($1, $2, 'text', $3)`, [
      chatId, userId, offerText,
    ]);
    await this.alertBoth(chat, isCounter ? 'Counter-offer' : 'New offer', offerText, 'system');
    await db.query('UPDATE chats SET last_message = $1, last_from_id = $2, updated_at = NOW() WHERE id = $3', [
      isCounter ? 'Counter offer' : 'New swap offer', userId, chatId,
    ]);
    const offerNote = (body.payWithTokens || tokens > 0)
      ? `Skill plus ${tokens} token(s).`
      : 'Skill exchange.';
    const other = this.otherId(chat, userId);
    const otherName = Number(chat.user_a_id) === Number(userId) ? chat.name_b : chat.name_a;
    await this.alert(other, isCounter ? 'Counter-offer received' : 'New offer received', (isCounter ? 'A counter-offer is waiting. ' : 'An offer is waiting. ') + offerNote, 'offer', chatId, userId, Number(chat.user_a_id) === Number(userId) ? chat.name_a : chat.name_b);
    return this.get(chatId, userId);
  }

  async respondSwap(chatId: number, userId: number, action: 'accepted' | 'rejected', body: any = {}) {
    const offer = await this.latestOffer(chatId);
    if (!offer || !['PROPOSED', 'COUNTERED'].includes(offer.status)) throw new BadRequestException('No pending offer');
    if (Number(userId) === Number(offer.proposed_by)) throw new BadRequestException('The other person must respond');
    if (action === 'accepted') await this.assertNoBlockingDuty(userId);
    const skillOffered = String(body.skillOffered || '').trim();
    if (action === 'accepted' && skillOffered && this.banned(skillOffered)) {
      throw new BadRequestException('This activity is not allowed on Skill4Handel');
    }
    const amount = Number(offer.extra_tokens || 0);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      if (action === 'accepted' && amount > 0) {
        const payerId = Number(offer.proposed_by);
        const locked = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [payerId]);
        const reserved = await client.query(
          `SELECT COALESCE(SUM(extra_tokens), 0)::int AS reserved
           FROM exchange_offers
           WHERE proposed_by = $1 AND status IN ('ACCEPTED', 'DISPUTED') AND COALESCE(settled, FALSE) = FALSE AND id <> $2`,
          [payerId, offer.id],
        );
        const available = Number(locked.rows[0]?.balance || 0) - Number(reserved.rows[0]?.reserved || 0);
        if (available < amount) {
          throw new BadRequestException('The requester does not currently have enough tokens for this exchange.');
        }
      }
      if (action === 'accepted' && skillOffered) {
        await client.query(
          `UPDATE exchange_offers
           SET status = 'ACCEPTED', skill_offered = $1, done_by = '{}', reviewed_by = '{}', updated_at = NOW()
           WHERE id = $2`,
          [skillOffered, offer.id],
        );
      } else {
        await client.query(
          `UPDATE exchange_offers SET status = $1, done_by = '{}', reviewed_by = '{}', updated_at = NOW() WHERE id = $2`,
          [action === 'accepted' ? 'ACCEPTED' : 'REJECTED', offer.id],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    const text = action === 'accepted'
      ? (skillOffered
          ? `The offer has been accepted. Return skill: ${skillOffered}.`
          : 'The offer has been accepted. The session is confirmed.')
      : 'The offer has been declined.';
    const chat = (await db.query('SELECT * FROM chats WHERE id = $1', [chatId])).rows[0];
    try {
      await db.query(`INSERT INTO messages (chat_id, from_id, type, text) VALUES ($1, $2, 'text', $3)`, [
        chatId, userId, text,
      ]);
      if (chat) await this.alertBoth(chat, action === 'accepted' ? 'Offer accepted' : 'Offer declined', text, 'system');
    } catch (_) {}
    await db.query('UPDATE chats SET last_message = $1, last_from_id = $2, updated_at = NOW() WHERE id = $3', [
      action === 'accepted' ? 'Offer accepted' : 'Offer declined', userId, chatId,
    ]);
    if (chat) {
      const senderName = Number(chat.user_a_id) === Number(userId) ? chat.name_a : chat.name_b;
      await this.alert(Number(offer.proposed_by), action === 'accepted' ? 'Offer accepted' : 'Offer declined', action === 'accepted' ? 'Your offer has been accepted.' : 'Your offer has been declined.', 'offer', chatId, userId, senderName);
    }
    return this.get(chatId, userId);
  }

  async cancelSwap(chatId: number, userId: number) {
    const offer = await this.latestOffer(chatId);
    if (!offer) throw new BadRequestException('No offer to cancel');
    const members = await db.query('SELECT * FROM chats WHERE id = $1', [chatId]);
    const chatRow = members.rows[0];
    if (chatRow && ![Number(chatRow.user_a_id), Number(chatRow.user_b_id)].includes(Number(userId))) {
      throw new BadRequestException('You are not part of this chat');
    }
    if (['PROPOSED', 'COUNTERED'].includes(offer.status)) {
      // either member may cancel a pending offer
    } else if (offer.status === 'ACCEPTED') {
      if (!offer.scheduled_at) throw new BadRequestException('No scheduled time on this offer');
      const hours = (new Date(offer.scheduled_at).getTime() - Date.now()) / 36e5;
      if (hours < 24) throw new BadRequestException('Cancel is only allowed until 24 hours before the agreed time');
    } else {
      throw new BadRequestException('This offer cannot be cancelled');
    }
    await db.query(`UPDATE exchange_offers SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`, [offer.id]);
    const chat = chatRow || (await db.query('SELECT * FROM chats WHERE id = $1', [chatId])).rows[0];
    try {
      await db.query(`INSERT INTO messages (chat_id, from_id, type, text) VALUES ($1, $2, 'text', $3)`, [
        chatId, userId, 'The offer was cancelled. Both members may start a new request.',
      ]);
      if (chat) await this.alertBoth(chat, 'Offer cancelled', 'The offer was cancelled. Both members may start a new request.', 'system');
    } catch (_) {}
    await db.query(
      'UPDATE chats SET last_message = $1, last_from_id = $2, updated_at = NOW() WHERE id = $3',
      ['Offer cancelled. A new request may be started.', userId, chatId],
    );
    if (chat) {
      await this.ping(
        this.otherId(chat, userId),
        'Offer cancelled',
        'An offer was cancelled. A new request may be started.',
        { type: 'offer', chatId: String(chatId) },
      );
    }
    return this.get(chatId, userId);
  }

  private isSkillSwap(offer: any) {
    const offered = String(offer.skill_offered || '').toLowerCase();
    const level = String(offer.level || '').toLowerCase();
    if (level === 'volunteer' || offered === 'volunteer help') return false;
    if (offered === 's4h tokens') return false;
    return String(offer.skill_offered || '').trim().length > 0;
  }

  async markDone(chatId: number, userId: number) {
    const chatRes = await db.query('SELECT * FROM chats WHERE id = $1', [chatId]);
    const chat = chatRes.rows[0];
    const offer = await this.latestOffer(chatId);
    if (!chat || !offer || offer.status !== 'ACCEPTED') throw new BadRequestException('Offer is not accepted yet');
    if (!offer.scheduled_at) throw new BadRequestException('This offer has no scheduled time');
    if (new Date(offer.scheduled_at).getTime() > Date.now()) {
      throw new BadRequestException('You can mark it done only after the agreed time');
    }
    const doneBy = new Set<number>(offer.done_by || []);
    doneBy.add(Number(userId));
    const both = doneBy.has(Number(chat.user_a_id)) && doneBy.has(Number(chat.user_b_id));
    await db.query(
      `UPDATE exchange_offers
       SET done_by = $1, status = 'ACCEPTED', first_done_at = CASE WHEN $2::int = 1 THEN COALESCE(first_done_at, NOW()) ELSE first_done_at END, last_reminder_at = CASE WHEN $2::int = 1 THEN COALESCE(last_reminder_at, NOW()) ELSE last_reminder_at END, updated_at = NOW()
       WHERE id = $3`,
      [[...doneBy], doneBy.size, offer.id],
    );
    try {
      const doneText = both
        ? 'Both members confirmed completion. Reviews can now be written.'
        : 'Completion has been confirmed by one member. Waiting for the other confirmation.';
      await db.query(`INSERT INTO messages (chat_id, from_id, type, text) VALUES ($1, $2, 'text', $3)`, [
        chatId, userId, doneText,
      ]);
      await this.alertBoth(chat, 'Exchange update', doneText, both ? 'review' : 'system');
    } catch (_) {}
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
              `INSERT INTO wallet_transactions (user_id, type, amount, title, exchange_offer_id) VALUES ($1,'BONUS',1,$2,$3)`,
              [chat.user_a_id, `Skill swap bonus for ${offer.skill_requested}`, offer.id],
            );
            await client.query(
              `INSERT INTO wallet_transactions (user_id, type, amount, title, exchange_offer_id) VALUES ($1,'BONUS',1,$2,$3)`,
              [chat.user_b_id, `Skill swap bonus for ${offer.skill_requested}`, offer.id],
            );
          }
          await client.query(`UPDATE exchange_offers SET settled = TRUE, status = 'SETTLED', updated_at = NOW() WHERE id = $1`, [offer.id]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    if (both) await db.query('UPDATE chats SET last_message = $1, updated_at = NOW() WHERE id = $2', ['Swap completed', chatId]);
    await this.ping(
      this.otherId(chat, userId),
      both ? 'Exchange completed' : 'Completion confirmed',
      both
        ? 'The exchange is complete. Please leave a review.'
        : 'The other member has marked the exchange as complete.',
      { type: 'offer', chatId: String(chatId) },
    );
    return this.get(chatId, userId);
  }

  async markReviewed(chatId: number, userId: number) {
    const offer = await this.latestOffer(chatId);
    if (!offer) throw new BadRequestException('Chat not found');
    const reviewedBy = new Set<number>(offer.reviewed_by || []);
    reviewedBy.add(Number(userId));
    await db.query('UPDATE exchange_offers SET reviewed_by = $1, updated_at = NOW() WHERE id = $2', [[...reviewedBy], offer.id]);
    return this.get(chatId, userId);
  }

  async remove(chatId: number, userId: number) {
    const result = await db.query('SELECT * FROM chats WHERE id = $1', [chatId]);
    const chat = result.rows[0];
    if (!chat) throw new BadRequestException('Chat not found');
    if (Number(userId) !== Number(chat.user_a_id) && Number(userId) !== Number(chat.user_b_id)) {
      throw new BadRequestException('Not in this chat');
    }
    const offer = await this.latestOffer(chatId);
    if (offer && ['ACCEPTED', 'DISPUTED'].includes(offer.status)) {
      throw new BadRequestException('This chat cannot be deleted while the exchange is still open. Complete the exchange and write the review first.');
    }
    if (offer && offer.status === 'SETTLED') {
      const reviewed = (offer.reviewed_by || []).map((value: any) => Number(value));
      if (!reviewed.includes(Number(userId))) {
        throw new BadRequestException('This chat cannot be deleted until you write the review and the exchange process is complete.');
      }
    }
    const other = Number(chat.user_a_id) === Number(userId) ? Number(chat.user_b_id) : Number(chat.user_a_id);
    const mine = Number(chat.user_a_id) === Number(userId) ? chat.name_a : chat.name_b;
    const hadOffer = offer && ['PROPOSED', 'COUNTERED'].includes(offer.status);
    const note = hadOffer
      ? `${mine || 'A member'} deleted the chat. The unanswered offer was cancelled.`
      : `${mine || 'A member'} deleted the chat. Messages in that chat were removed.`;
    try {
      await this.alert(other, 'Chat deleted', note, 'deleted', 0, userId, mine);
    } catch (_) {}
    await db.query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
    await db.query('DELETE FROM exchange_offers WHERE chat_id = $1', [chatId]);
    await db.query('DELETE FROM chats WHERE id = $1', [chatId]);
    return { ok: true };
  }
}