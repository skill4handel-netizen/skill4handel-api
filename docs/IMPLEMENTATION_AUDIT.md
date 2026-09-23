# IMPLEMENTATION_AUDIT.md

Date: 18 September 2026  
Sources of truth: GitHub `skill4handel-app` / `skill4handel-api`, production API `https://skill4handel-api.onrender.com`, Neon (not inspected live; inferred from `schema.sql` + later service code).

---

## Executive Summary

The product is a working Android-first MVP: Flutter talks to a NestJS API on Render, data lives in Neon PostgreSQL. Auth, profile, search, chat, offers, wallet, reviews, support, admin, and Dutch/English strings exist and are used in production.

It is **not** production-hardened. Identity is still often taken from a client `userId`. Email sending is optional and usually fails. Push is not implemented. `schema.sql` is behind the running code (blocks / device tokens / extra user columns were added in SQL later, not in the file). `users.json` is leftover. iOS project files exist but there is no store-ready iOS pipeline. Blockchain and AI are not present and must not start yet.

Recommended next slice: finish the audit actions below in this order — auth from JWT, real email, push, exchange/wallet concurrency — then iOS. Do not expand to Europe or smart contracts in this slice.

---

## Current Architecture

```
Flutter app (Dio → https://skill4handel-api.onrender.com)
        ↓
NestJS on Render (Frankfurt, free instance)
        ↓
Neon PostgreSQL
        ↳ Resend (optional, domain not production-ready)
        ↳ /admin HTML
```

App session: `lib/core/constants/session.dart` + `flutter_secure_storage`.  
No Riverpod/Bloc network layer; screens call Dio directly.  
JWT exists (`src/auth/token.ts`, 7-day expiry) but most routes still accept `userId` in query/body.

---

## Working Features

| Feature | Actual status | Evidence | Risk | Required action | Phase |
|---|---|---|---|---|---|
| Signup / login | Working | `/auth/signup`, `/auth/login` | Client can send another userId later | Bind every route to JWT | 1 |
| Profile + photo | Working | `/auth/profile`, `/auth/photo` | Large data-URL photos | Keep size cap | 1 |
| Search + match % | Working | `/matches`, home/search screens | Score still simple | Keep deterministic; document formula | 3 |
| Chat | Working (poll/reload) | `/chats`, `chat_screen.dart` | Not realtime | FCM first, sockets later | 1–2 |
| Offer state machine | Working in code | `chat.service.ts` statuses PROPOSED…REVIEWED | Expiry + cancel edge cases historically buggy | Harden transitions + transactions | 1 |
| Wallet display | Working | `/auth/me` history | Delete was client-only until recent route | Keep ledger server-side | 1 |
| Reviews | Working after settle | `/auth/review`, `/chats/:id/reviewed` | Must stay backend-gated | Keep | 1 |
| Block / report / support | Working | `/auth/block`, tickets | `blocks` table not in `schema.sql` | Add to schema file | 1 |
| Admin HTML | Working | `/admin` | Password in env only | Keep off public docs | 1 |
| Dark mode + NL/EN | Partial | `app_strings.dart` | Some screens still English until latest local files | Finish remaining strings | 1 |
| Android APK/AAB | Working | `flutter build` history | `applicationId` still `com.example.skill4handel` | Change before public Play | 1–2 |

---

## Partially Implemented Features

| Feature | Actual status | Evidence | Risk | Required action | Phase |
|---|---|---|---|---|---|
| Email verification | Token + in-app link work; inbox usually empty | `src/mail.ts`, `email_verifications` | Users think mail was sent | Resend domain + hashed tokens + expiry | 1 |
| Forgot / change password | Exists | `/auth/forgot-password` sets password directly | No emailed reset token | Reset email + hashed token | 1 |
| Device tokens | Column/API sketched in later auth code | `/auth/device-token` | No FCM send | Firebase + send service | 1 |
| Offer auto-expire | Implemented in service | `expireOldOffer` | Depends on request traffic, no cron | Add scheduled job | 1 |
| City | Free text + new local NL list (not all shipped) | `city_picker.dart` / `cities.dart` | Bad city names break matching and future contracts | Canonical NL city + country | 1 / 8 |
| Wallet delete | Route added; older builds lack item `id` | `DELETE /auth/transaction` | Testers on old API see no-op | Ship API + app together | 1 |
| iOS folder | Default Flutter ios/ present | `ios/Runner.xcodeproj` | No signing, no TestFlight | Phase 2 | 2 |

---

## Missing Features

- Push notification delivery  
- JWT-only authorization on chat/wallet/admin mutations  
- Password-reset email  
- Rate limiting / Helmet-style hardening  
- Cron for expiry  
- `blocks`, `device_tokens`, `password_resets` in `schema.sql`  
- iOS TestFlight  
- AI  
- Blockchain / smart contracts  
- Reputation formula  
- Europe city coverage (explicitly out of scope now)

---

## Security Gaps

1. **Client `userId` is trusted** on many POST/GET bodies. An attacker who knows another id can act as them if they can hit the API.  
2. **JWT secret fallback** in code if env missing.  
3. **Forgot-password** can set a new password without a mailed one-time token (by design of current MVP).  
4. **Verification tokens stored raw** in `email_verifications.token`.  
5. **No rate limit** on login, signup, forgot, ticket.  
6. **Admin** is a shared password, not an audited admin user table.  
7. **CORS / input enums** not systematically validated.  
8. Photos as data URLs can bloat the `users` row.

---

## Database Risks

- `schema.sql` is stale vs live Neon (extra user columns: language, photo, last_login, age…; blocks; device tokens).  
- No unique constraint on reviews per exchange.  
- `exchange_offers.settled` + `done_by[]` need transactional updates (partially in `markDone`).  
- `wallet_transactions.exchange_offer_id` has no FK.  
- JSON leftovers `users.json` / `chats.json` must not be read in production (API now uses Postgres).

---

## Flutter Risks

- Every screen creates its own `Dio` with a hard-coded Render URL.  
- `widget_test.dart` still outdated in some trees.  
- `applicationId` `com.example.skill4handel` is not a production id.  
- No Firebase packages in `pubspec.yaml` (`1.0.0+1`).  
- No crash reporting.

---

## Android Status

- Release APK/AAB have been built.  
- `compileSdk` 37.  
- Ready for **closed testing**, not for production listing until package name, Data safety, and 12 testers / 14 days are done.  
- Push permission / FCM not wired.

---

## iOS Status

- Stock Flutter `ios/` exists.  
- No evidence of Apple Developer signing, Push capability, or TestFlight in repo.  
- Phase 2. Do not block Phase 1 mail/push design on iOS, but implement notification service so iOS can hook APNs later.

---

## AI Readiness

Not ready. Need clean events (offer settled, report opened, cancel reason) and a reputation table first. AI must stay assistive, never settle or ban.

---

## Blockchain Readiness

Not ready. Operational ledger is PostgreSQL and must stay that way for Phase 1–5.  
Prerequisite data: canonical city + country, stable user id, immutable wallet rows, no double settlement.  
Do not introduce Solidity, wallets, or on-chain S4H now.

---

## Documentation Conflicts

| Doc / pitch | Code |
|---|---|
| Email is sent | Resend often rejects; app uses `verifyUrl` |
| JSON storage retired | `users.json` still in API repo |
| Full NL app | Support / some system lines were still English until latest local patch |
| schema.sql = database | Live DB has extra tables/columns |
| Needs skills on profile | Product later moved needs to the offer form |

---

## Legacy Code

- `users.json`, `chats.json` in API repo  
- Early JSON user store replaced by `pg`  
- `com.example` Android id  
- Nominatim city search (unreliable); replaced locally by static list in the latest patch, not necessarily pushed

---

## Technical Debt

- No shared API client / auth interceptor  
- No integration tests for offer transitions  
- Render free-tier cold start (~50s)  
- Admin is HTML in the API process  
- Matching formula not documented in code comments

---

## Recommended Execution Order

1. Audit (this file)  
2. JWT on mutating routes (do not trust body `userId`)  
3. Real email (Resend domain) + reset tokens  
4. Push infrastructure (Firebase Cloud Messaging)  
5. Exchange + wallet transaction locks + cron expiry  
6. Canonical NL city field  
7. Closed-test AAB when the above user-visible slice is stable  
8. iOS / TestFlight  
9. Trust score + explainable matching  
10. AI assistant  
11. Economy 2.0  
12. Blockchain  
13. Europe last  

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Impersonation via userId | High | JWT subject only |
| Mail never arrives | Medium | Domain + fallback in-app link |
| Double settlement | High | DB transaction + settled flag |
| Play production blocked | Medium | Keep closed test running |
| Starting blockchain too early | High | Ledger stays Postgres |
| Existing Firebase project mismatch | Medium | Reuse one project; do not create a second |
