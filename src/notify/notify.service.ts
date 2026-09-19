import { Injectable } from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { db } from '../db';

@Injectable()
export class NotifyService {
  private ready = false;

  private init() {
    if (this.ready) {
      return;
    }
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
    if (!raw) {
      console.log('PUSH SKIPPED: FIREBASE_SERVICE_ACCOUNT is missing');
      return;
    }
    try {
      const cred = JSON.parse(raw);
      if (getApps().length === 0) {
        initializeApp({
          credential: cert(cred),
        });
      }
      this.ready = true;
      console.log('FIREBASE READY');
    } catch (error) {
      console.log('FIREBASE INIT ERROR', error);
    }
  }

  async sendToUser(userId: number, title: string, body: string, data: Record<string, string> = {}) {
    this.init();
    const tokens = await db.query('SELECT token FROM device_tokens WHERE user_id = $1', [userId]);
    if (!tokens.rows.length) {
      console.log('PUSH SKIPPED: no device token for user', userId);
      return { ok: true, sent: 0, reason: 'no-token' };
    }
    if (!this.ready) {
      console.log('PUSH SKIPPED: no Firebase key', userId, title);
      return { ok: true, sent: 0, reason: 'no-firebase-key' };
    }
    try {
      const result = await getMessaging().sendEachForMulticast({
        tokens: tokens.rows.map((row: { token: string }) => row.token),
        notification: { title, body },
        data: { title, body, ...data },
        android: {
          priority: 'high',
          notification: {
            channelId: 'skill4handel',
            sound: 'default',
          },
        },
      });
      console.log('PUSH RESULT', userId, result.successCount, result.failureCount);
      const stale: string[] = [];
      result.responses.forEach((item, index) => {
        if (!item.success) {
          console.log('PUSH FAIL', item.error?.code, item.error?.message);
          const code = String(item.error?.code || '');
          if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
            stale.push(tokens.rows[index].token);
          }
        }
      });
      if (stale.length) {
        await db.query('DELETE FROM device_tokens WHERE token = ANY($1)', [stale]);
      }
      return { ok: true, sent: result.successCount, failed: result.failureCount };
    } catch (error) {
      console.log('PUSH ERROR', error);
      return { ok: false, sent: 0, reason: 'send-error' };
    }
  }
}
