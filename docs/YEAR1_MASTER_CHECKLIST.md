# YEAR1_MASTER_CHECKLIST

Updated: 23 September 2026 after Gate 0 audit.

| ID | Gate | Area | Task | Status | Priority | Blocker | Definition of Done | Evidence | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 0.1 | 0 | App | Flutter Android app exists | DONE | P0 | | APK/AAB builds | pubspec 3.0.1+4; release keystore | |
| 0.2 | 0 | API | NestJS live | DONE | P0 | | Render serves API | skill4handel-api.onrender.com | |
| 0.3 | 0 | DB | Postgres model | DONE | P0 | | schema + live Neon | schema.sql | columns added ad-hoc |
| 0.4 | 0 | App | Main tabs | DONE | P0 | | Home Search Chat Wallet Profile | main_shell.dart | |
| 0.5 | 0 | Auth | Signup/login/profile | DONE | P0 | | works on device/Chrome | auth screens | Google in progress |
| 0.8 | 0 | Exchange | State machine present | DONE | P0 | | statuses in chat.service | chat.service.ts | needs tests |
| 0.9 | 0 | Wallet | Ledger present | DONE | P0 | | transactions table | schema + markDone | concurrency unproven |
| 0.12 | 0 | Admin | Admin panel | IN PROGRESS | P0 | deploy discipline | login + users/tickets/exchanges | /admin | JS/module breakage history |
| 0.13 | 0 | Auth | Prod email/reset | IN PROGRESS | P0 | real mail provider | inbox link only; reset tokenized | verify HTML | reset still sets password directly |
| 0.14 | 0 | Notify | Push | IN PROGRESS | P1 | FCM product config | events delivered on device | device_tokens | not all events |
| 0.15 | 1 | Security | JWT on protected routes | MISSING | P0 | code change | no userId impersonation | routes use body.userId | **next gate** |
| 1.1 | 1 | Security | bcrypt passwords | MISSING | P0 | migration of hashes | new hashes bcrypt; old users migrate | SHA-256 now | |
| 1.2 | 1 | Security | reset tokens | MISSING | P0 | | one-time expiring reset | forgotPassword writes hash | |
| 1.3 | 1 | Security | rate limit + CORS | MISSING | P0 | | abuse limited; CORS allowlist | none | |
| 2.1 | 2 | Wallet | settlement tests | MISSING | P0 | test harness | double pay impossible | markDone txn exists | |
| 3.1 | 3 | Tests | real API+app tests | MISSING | P0 | time | critical flows green | stubs only | |
| 4.1 | 4 | Android | 12 testers 14 days | MISSING | P0 | recruit testers | Play production unlock | Console | |
| 4.2 | 4 | iOS | TestFlight | MISSING | P1 | Apple account | build on device | ios:false | |
| 5.1 | 5 | i18n | full Dutch | IN PROGRESS | P0 | copy pass | all user strings localized | app_strings + hardcoded EN | |
| 7.1 | 7 | Pilot | 150 NL users | MISSING | P0 | gates 1–5 | real users not test accounts | | do not start marketing blast |
| 9.1 | 9 | AI | architecture only | NOT NEEDED YET | P2 | usage data | doc only | | |
| 11.1 | 11 | Chain | architecture only | NOT NEEDED YET | P2 | economy spec | doc only | | |
