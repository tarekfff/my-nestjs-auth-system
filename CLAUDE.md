# Ompleo Backend — Job Platform API (V2)

NestJS 11 project. Express adapter. Prisma + PostgreSQL.

## Role

You are a senior NestJS developer. Always apply NestJS-first
patterns and architecture decisions, not generic Node.js approaches.

## What this app is

Backend for Ompleo, an Algerian job platform (FR / AR / EN).
Candidates apply to offers WITHOUT any account (CV PDF + optional
audio/video per offer), and every application is guaranteed a
response via WhatsApp before the offer's closing date. Companies
are verified and created manually by the Ompleo team. An AI
pipeline moderates media and structures dossiers but NEVER decides.

Reference documents (source of truth, in this order):
1. `docs/Ompleo_Cahier_des_charges_fonctionnel_V2.pdf` — functional spec
2. `docs/ARCHITECTURE_V2.md` — backend architecture
3. `prisma/schema.prisma` — data model (mirrors docs/schema_v2.sql)

## Product invariants (NEVER violate, they override any request)

- **No candidate accounts.** No candidate table, no candidate auth,
  no candidate dashboard. Candidate identity lives on each
  application row. The only candidate-facing token is the one-time
  media-redo link (hashed, expires on use or offer closure).
- **No public company registration.** No /register route may exist
  (R10). Companies and their user accounts are created only from
  the admin module by staff.
- **AI never decides.** No score, no percentage, no recommendation
  anywhere in company-facing data (R24). The AI pipeline may only
  set media statuses and the `media_a_completer` application status.
  Only the closure automation may auto-refuse (R09, R14).
- **Media isolation.** A company can only ever read media with
  status `valide` AND `is_current` (R06). Blocked media and
  block_reason never leave the admin surface. Enforce in the query
  layer of every company endpoint, not just the controller.
- **Company scoping.** `companyId` always comes from the JWT via
  guard — never from body, query, or params (R16).
- **Configurable limits.** File size, audio/video durations,
  reminder days, decision deadline: always read from
  platform_settings, never hardcoded (R22).
- **Private files.** All buckets private; access via short-lived
  signed URLs only; every sensitive download writes an activity_log
  row (R17, 19.1).

## Three API surfaces

| Prefix | Auth | Consumers |
|--------|------|-----------|
| /api/public | none (rate-limited by IP hash) | public site: jobs list/detail, company profiles, applications, similar offers, media-redo, CMS contents, leads |
| /api/company | JWT userType=COMPANY + CompanyScoped guard | espace entreprise: dashboard, offers (requests, never direct publish), conformant applications, read-only billing, settings |
| /api/admin | JWT userType=STAFF + Roles(ADMIN\|OPERATIONS\|CLOSER) | back-office: leads, verification, company/account creation, offer workflow, moderation queue, templates, billing, CMS, settings, activity log |

## Contract rules (do not deviate)

- Offer lifecycle: brouillon → soumise → (a_completer ↔ en_revue) →
  planifiee → active → cloturee → archivee. Companies submit
  requests; only staff/system transitions beyond `soumise`.
  Ompleo sets publish_at and closes_at; companies only express
  `desired_delay` (free text).
- Application submission is ONE transaction: verify job is
  `active` (reject if closed mid-flight, R13), validate fields
  (city + timestamped consent required, message ≤ 500 chars,
  WhatsApp normalized to +213 E.164), dedup on
  (job_id, lower(email), whatsapp) → on duplicate return a
  friendly 409 `already_applied` with the response date, never a
  second row (R02).
- Media: each file is a versioned `application_media` row with
  statuses non_demande / a_envoyer / envoye / en_analyse / valide /
  a_refaire / bloque / a_verifier. Every status change writes
  media_moderation_log. Uploads go direct-to-bucket via signed
  upload URLs — never through the API process.
- Application statuses: a_etudier, en_cours_etude, preselectionne,
  entretien_prevu, processus_en_cours, recrute, non_retenu,
  media_a_completer, cloturee_auto. Every change writes
  application_events with actor_type/actor_id.
- Messages: always rendered from message_templates
  (event × channel × lang), variables [Prénom] [Poste] [Entreprise]
  [date] [lien] [N]; every send historized in messages with
  provider status webhooks (R19). Candidate language = application.lang.
- Schedulers (publication, reminders J-7/3/1, closure sequence,
  post-closure guard-rail) must be idempotent: check for an
  existing message of the same event before queueing.
- Error envelope everywhere:
  `{ "error": { "code", "message", "request_id" } }`
  Codes: unauthorized, forbidden, invalid_request, not_found,
  already_applied, offer_closed, media_invalid, locked,
  must_change_password, rate_limited, internal_error.

## Auth

- Two populations, two Prisma models: CompanyUser (companyId,
  mustChangePassword, activationToken/Expires 72h, failedAttempts,
  lockedUntil) and StaffUser (role ADMIN | OPERATIONS | CLOSER).
  No generic User model.
- JWT access + refresh rotation; refresh tokens stored hashed
  (RefreshToken model). Claim `userType: COMPANY | STAFF`.
- Guards/decorators in src/common/: `TokenAuthGuard`,
  `@CompanyScoped()` (injects companyId from JWT),
  `@Roles(...StaffRole[])`.
- Login: lockedUntil in future → 423 `locked`. Failed attempt →
  increment, lock at threshold from settings. Success → reset.
- mustChangePassword=true → the ONLY permitted route is
  POST /auth/change-password.
- 401 = missing/invalid/expired token; 403 = valid token, wrong
  userType or role. Never reveal which.

## Data model (Prisma)

Wilaya (58, FR+AR), Sector, StaffUser, CompanyUser, RefreshToken,
Company (verification status, isCertified, isActive),
CompanyDocument, Lead + LeadNote, Job (8 statuses, media
requirements, publish_at/closes_at set by staff) + JobEvent +
JobChangeRequest, Application (identity on row, consent_at,
unique dedup index) + ApplicationEvent + ApplicationNote,
ApplicationMedia (versioned, 8 statuses) + MediaModerationLog +
MediaRedoLink (hashed token), AiDossier (NO score field — summary,
skills, matching_elements, to_verify, transcripts),
MessageTemplate + Message, Invoice + InvoiceLine + Pack,
CmsContent (group_key × lang, display contexts), PlatformSettings
(singleton), ActivityLog.

Booking-critical writes (application insert + closure sequence)
must be transactions — never read-then-write in JS.

## Code standards

- Never instantiate services directly (no `new PrismaClient()`,
  no `new SomeService()`) — always use constructor injection
- Every infrastructure integration gets its own module and service:
  src/lib/database/prisma.module.ts + prisma.service.ts
  src/lib/storage/storage.module.ts + storage.service.ts (signed URLs)
  src/lib/whatsapp/whatsapp.module.ts + whatsapp.service.ts
  src/lib/mail/mail.module.ts + mail.service.ts
  src/lib/queue/queue.module.ts (BullMQ) for async pipelines
- Mark infrastructure modules @Global() and import once in AppModule
- Feature modules go in src/module/<name>/ — expected modules:
  auth, companies, leads, jobs, applications, media, ai, messages,
  automations, billing, cms, admin, health
  (ownership: dev1 = auth/companies/leads/billing, dev2 =
  jobs/applications/media-upload, dev3 = ai/messages/automations/cms)
- Shared guards, interceptors, decorators go in src/common/
- Validation with class-validator DTOs + global ValidationPipe
  ({ whitelist: true, forbidNonWhitelisted: true })
- Global exception filter maps all errors to the error envelope
  and attaches a request_id (nanoid) to every response
- i18n: all candidate/company-facing strings come from templates or
  i18n files (FR/AR/EN) — never hardcode French strings in services
- Use Nest CLI: nest g module / nest g service / nest g controller

## Definition of done

A feature is done only when its recette criteria (section 20 of the
spec, R01–R24) have automated tests. The critical ones: R02 (dedup
cross-device), R06 (media isolation), R09/R24 (AI never decides,
no score), R13 (atomic closure), R14 (universal auto-response),
R16 (company isolation), R17 (signed-URL-only file access).

## Skills

Do not load any skill by default. Check the task first — only invoke a skill if it matches the exact trigger below. Never invoke a skill just because it exists.

- `/architect` — before building something non-trivial with no plan yet
- `/review` — when a feature is done and needs a production check
- `/recover` — when something is broken and the fix isn't obvious
- `/remember` — at the start of a new session to restore context,
  and at the end to save progress

## Session continuity

REQUIRED — do not skip, do not wait to be asked:

- **First action of every session:** run `/remember restore` before doing anything else.
- **Last action of every session:** run `/remember save` before closing.