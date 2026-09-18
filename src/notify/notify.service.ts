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
    } catch (error) {
      console.log('FIREBASE INIT ERROR', error);
    }
  }

  async sendToUser(userId: number, title: string, body: string, data: Record<string, string> = {}) {
    this.init();
    const tokens = await db.query('SELECT token FROM device_tokens WHERE user_id = $1', [userId]);
    if (!tokens.rows.length) {
      return { ok: true, sent: 0 };
    }
    if (!this.ready) {
      console.log('PUSH SKIPPED (no Firebase key)', userId, title, body);
      return { ok: true, sent: 0 };
    }
    try {
      const result = await getMessaging().sendEachForMulticast({
        notification: { title, body },
        data,
        tokens: tokens.rows.map((row: { token: string }) => row.token),
      });
      return { ok: true, sent: result.successCount };
    } catch (error) {
      console.log('PUSH ERROR', error);
      return { ok: false, sent: 0 };
    }
  }
}
