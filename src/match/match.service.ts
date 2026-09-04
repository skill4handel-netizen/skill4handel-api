import { Injectable } from '@nestjs/common';
import { db } from '../db';

function skills(value: string) {
  return (value || '')
    .toLowerCase()
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function overlap(a: string[], b: string[]) {
  return a.filter((item) => b.includes(item));
}

@Injectable()
export class MatchService {
  score(me: any, other: any) {
    const myOffers = skills(me.offers);
    const myNeeds = skills(me.needs);
    const theirOffers = skills(other.offers);
    const theirNeeds = skills(other.needs);
    const theyGiveWhatINeed = overlap(myNeeds, theirOffers);
    const iGiveWhatTheyNeed = overlap(theirNeeds, myOffers);

    const skillScore = theyGiveWhatINeed.length ? 35 : 0;
    const reciprocalScore = iGiveWhatTheyNeed.length ? 25 : 0;
    const availabilityScore = 15;
    const locationScore =
      me.city && other.city && me.city.trim().toLowerCase() === other.city.trim().toLowerCase()
        ? 10
        : 0;
    const exchangeScore = 5;
    const languageScore = 5;
    const trustScore = Math.round((Number(other.rating || 0) / 5) * 5);

    const total =
      skillScore +
      reciprocalScore +
      availabilityScore +
      locationScore +
      exchangeScore +
      languageScore +
      trustScore;

    const reasons = [];
    for (const skill of theyGiveWhatINeed) reasons.push(`They offer ${skill}`);
    for (const skill of iGiveWhatTheyNeed) reasons.push(`You offer ${skill}`);
    if (locationScore) reasons.push('Same city');
    if (other.email_verified) reasons.push('Verified');
    if (Number(other.rating) >= 4) reasons.push('Good rating');

    return { score: Math.min(100, total), reasons };
  }

  async forUser(userId: number) {
    const meRes = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    const me = meRes.rows[0];
    if (!me) return [];
    const others = await db.query(
      `SELECT * FROM users
       WHERE id <> $1 AND is_suspended = FALSE AND role <> 'admin'`,
      [userId],
    );
    return others.rows
      .map((other: any) => {
        const match = this.score(me, other);
        return {
          id: other.id,
          name: other.name,
          email: other.email,
          city: other.city || '',
          offers: other.offers || '',
          needs: other.needs || '',
          rating: Number(other.rating || 0),
          reviews: [],
          score: match.score,
          reasons: match.reasons,
        };
      })
      .filter((item: any) => item.score >= 20)
      .sort((a: any, b: any) => b.score - a.score);
  }
}