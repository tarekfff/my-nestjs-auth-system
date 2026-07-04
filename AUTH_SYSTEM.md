# Auth System — How It Works

A full JWT authentication system built on NestJS 11 + Prisma + PostgreSQL, with email verification, password reset (via Resend), refresh-token rotation, role-based access control, rate limiting, and auto-generated API docs.

## 1. Project layout

```
prisma/schema.prisma          # User, RefreshToken models + Role enum
src/
  main.ts                     # bootstrap: pipes, interceptor, guards, Swagger
  app.module.ts                # root module wiring everything together
  lib/
    database/                 # Prisma — @Global(), one connection for the whole app
      prisma.module.ts
      prisma.service.ts
    mail/                      # Resend wrapper — @Global()
      mail.module.ts
      mail.service.ts
  common/                      # shared, reusable across feature modules
    decorators/
      public.decorator.ts       # @Public() — bypass the global auth guard
      roles.decorator.ts        # @Roles(Role.ADMIN) — declare required role(s)
      current-user.decorator.ts # @CurrentUser() — pull the authenticated user off the request
    guards/
      jwt-auth.guard.ts          # global guard, checks access token unless @Public()
      jwt-refresh.guard.ts       # guards POST /auth/refresh, checks refresh token
      roles.guard.ts             # per-route, checks @Roles() against the user's role
    types/
      request-user.interface.ts # shape of req.user: { id, role }
  module/
    user/                       # Prisma-backed user data access + profile routes
      user.service.ts
      user.controller.ts        # GET /users/me, GET /users (admin)
      entities/user.entity.ts   # response shape — strips password/tokens
    auth/                       # the auth flow itself
      auth.service.ts           # all business logic lives here
      auth.controller.ts        # HTTP routes
      auth.module.ts
      dto/                      # request validation (class-validator)
      strategies/                # Passport strategies (access + refresh)
      types/jwt-payload.interface.ts
  utils/
    transform.interceptor.ts    # wraps every response in { statusCode, message, data }
```

## 2. Data model (`prisma/schema.prisma`)

**`User`**
| Field | Purpose |
|---|---|
| `id`, `email`, `password`, `name`, `role` | core account fields; `password` is a bcrypt hash, never the plaintext |
| `isEmailVerified` | login is blocked (`403`) until this is `true` |
| `emailVerificationCode` / `emailVerificationExpires` | single-use 6-digit OTP code emailed to the user, 15-min expiry |
| `passwordResetCode` / `passwordResetExpires` | single-use 6-digit OTP code emailed to the user, 15-min expiry |
| `refreshTokens` | one-to-many relation to `RefreshToken` (a row per active session) |

**`RefreshToken`**
| Field | Purpose |
|---|---|
| `id` | used as the `jti` claim embedded in the refresh JWT |
| `hashedToken` | bcrypt hash of a random secret — the actual credential being checked |
| `userId`, `expiresAt`, `revoked` | who owns it, when it dies, and whether it's still usable |

Why a DB row per session instead of just trusting the JWT: it's what makes **logout**, **logout-all**, and **stolen-token detection** possible — a JWT alone can't be revoked before it naturally expires, but a DB-backed session can.

## 3. Request pipeline (what happens to every request)

Order, as wired in `src/main.ts`:

1. **`ValidationPipe`** (`whitelist`, `forbidNonWhitelisted`, `transform: true`) — every `@Body()`/`@Query()` is validated against its DTO's `class-validator` decorators; unknown fields are rejected with `400`.
2. **Guards**, in this order:
   - **`ThrottlerGuard`** — rate limiting (see §6). Runs first so abusive traffic is rejected before anything else does work.
   - **`JwtAuthGuard`** — the *global* auth guard. For every route, it checks for `@Public()` metadata (via `Reflector`); if present, it lets the request through with no auth check. Otherwise it runs the `'jwt'` Passport strategy, which verifies the `Authorization: Bearer <token>` header against `JWT_ACCESS_SECRET` and attaches `{ id, role }` to `request.user`.
   - **`RolesGuard`** (only on routes that declare `@Roles(...)`, e.g. `GET /users`) — compares `request.user.role` against the required role(s).
3. **Controller handler** runs, calls into a `*.service.ts`.
4. **`TransformInterceptor`** — wraps whatever the handler returned into `{ statusCode, message: 'Success', data }`. It also runs the return value through `class-transformer`'s `instanceToPlain`, which is what actually strips `@Exclude()`-marked fields (like `password`) from `UserEntity` before it reaches the client.

## 4. Auth flows

All routes live under `src/module/auth/auth.controller.ts` → `auth.service.ts`.

### Register — `POST /auth/register` (public)
Body: `{ name, email, password }`.
1. Rejects if the email is already taken (`409`).
2. Hashes the password with bcrypt (cost factor 10).
3. Generates a random **6-digit verification code**, stores it + a 15-min expiry on the user row.
4. Creates the user (`isEmailVerified: false`).
5. Emails the code via `MailService` (fire-and-forget — a failed send doesn't fail registration; the user can hit `resend-verification` later).
6. Returns the created user and a message telling the frontend to show the "enter your code" screen (no tokens — you must verify before logging in).

### Verify email — `POST /auth/verify-email` (public)
Body: `{ email, code }`. Looks the user up by email, compares the 6-digit code, checks it hasn't expired, flips `isEmailVerified` to `true`, and clears the code fields. Throttled to 5/min so the code can't be brute-forced.

**Typical frontend flow:** register form → success screen saying "we emailed you a code" with a 6-digit input → `POST /auth/verify-email` → redirect to login (or auto-login).

### Login — `POST /auth/login` (public)
1. Looks up the user by email; compares the password with bcrypt.
2. On any failure (no such user, or wrong password) → generic `401 Invalid credentials`. This is deliberate: the API never reveals whether an email exists, to prevent account enumeration.
3. If the password is correct but the account isn't verified → `403 Email not verified`.
4. Otherwise issues a fresh **access token + refresh token** pair (see §5) and returns them alongside the user profile.

Login (and refresh) responses are frontend-ready:
```json
{
  "accessToken": "...",
  "accessTokenExpiresAt": "2026-07-04T22:13:40.932Z",
  "refreshToken": "...",
  "refreshTokenExpiresAt": "2026-07-11T21:58:40.932Z",
  "user": { "id": "...", "name": "...", "email": "...", "role": "USER", "isEmailVerified": true }
}
```
- `user.role` drives dashboard UI (show/hide admin sections) without decoding the JWT — the same role is also inside the access token payload for the backend's own checks.
- The `...ExpiresAt` timestamps let the frontend schedule a silent refresh just before the access token dies, instead of waiting for a `401`.

### Refresh — `POST /auth/refresh` (public route, but guarded by `JwtRefreshGuard`)
Rotates a refresh token for a new access/refresh pair. See §5 for the full algorithm — this is the most involved piece of the system.

### Logout — `POST /auth/logout` (public)
Takes a `refreshToken` in the body, verifies it, and marks that one session's `RefreshToken` row as `revoked`. An already-invalid token is treated as "already logged out" rather than erroring.

### Logout everywhere — `POST /auth/logout-all` (requires a valid access token)
Revokes every non-revoked `RefreshToken` row for the current user — useful for "log out of all devices."

### Forgot / reset password
- `POST /auth/forgot-password` (public): if the email exists, generates a 6-digit reset code (15-min expiry) and emails it. Always returns the same generic success message whether or not the account exists (same anti-enumeration principle as login).
- `POST /auth/reset-password` (public), body `{ email, code, newPassword }`: validates the code + expiry, hashes and saves the new password, and — importantly — **revokes every refresh token the user had**. A password reset invalidates all existing sessions, since the old password (and potentially old sessions) may have been compromised.

## 5. Access + refresh tokens, in detail

Two separate JWTs, two separate secrets (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`), two separate Passport strategies (`src/module/auth/strategies/`):

- **Access token** (`jwt.strategy.ts`) — short-lived (`JWT_ACCESS_EXPIRES_IN`, default `15m`), payload `{ sub: userId, role }`. Sent as `Authorization: Bearer <token>`. This is what `JwtAuthGuard` checks on every protected route.
- **Refresh token** (`jwt-refresh.strategy.ts`) — long-lived (`JWT_REFRESH_EXPIRES_IN`, default `7d`), payload `{ sub: userId, jti, secret }`. Sent in the request body (`refreshToken` field) — extracted there, not from a header, so it never accidentally gets sent as a bearer token to some other endpoint.

**Issuing a pair** (`AuthService.issueTokenPair`, called on login and on every refresh):
1. Generate a random secret, bcrypt-hash it, and store it as a new `RefreshToken` row (`hashedToken`, `expiresAt`, `revoked: false`).
2. Sign the access token with `{ sub, role }`.
3. Sign the refresh token with `{ sub, jti: <the new row's id>, secret: <the plaintext random secret> }`.

**Rotating on refresh** (`AuthService.refresh`):
1. `JwtRefreshGuard` already verified the JWT signature and expiry before this code even runs.
2. Look up the `RefreshToken` row by `jti`. Doesn't exist, or belongs to a different user than the token claims → reject.
3. **If the row is already `revoked`**: this exact refresh token was already used once before (or explicitly logged out) and is being replayed — a strong signal of token theft. React by revoking **every** session for that user and rejecting with "please log in again."
4. If the row's `expiresAt` has passed → reject (belt-and-suspenders alongside the JWT's own expiry).
5. `bcrypt.compare(secret, row.hashedToken)` — this is the actual credential check; the `jti` is just a lookup key, the `secret` is what proves you hold a legitimate, unrevoked token.
6. Mark the old row `revoked`, then issue a brand-new pair. The old refresh token can never be used again — every refresh consumes one token and mints a new one.

This means a stolen-but-unused refresh token can be revoked-on-reuse the moment the legitimate owner refreshes again, and a compromised session can always be killed via `logout` / `logout-all` / a password reset.

## 6. Role-based access control

- `Role` enum in Prisma: `USER` (default) | `ADMIN`.
- `@Roles(Role.ADMIN)` (from `src/common/decorators/roles.decorator.ts`) attaches metadata to a route.
- `RolesGuard` reads that metadata and compares it to `request.user.role` (populated earlier by `JwtAuthGuard`). No `@Roles()` on a route → guard is a no-op.
- Applied per-route, not globally (only `UseGuards(RolesGuard)` + `@Roles(...)` on `GET /users` right now) — most routes don't need a role check, and this avoids guard-ordering pitfalls that come with making it global.

## 7. Rate limiting

`@nestjs/throttler`, configured in `app.module.ts` (`ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 10 }])`) and applied globally via `app.get(ThrottlerGuard)` in `main.ts`.

- **Default**: 10 requests/minute per IP, across the whole API.
- **Tighter limits** on abuse-prone routes (`@Throttle({ default: { limit, ttl } })` in `auth.controller.ts`):
  - `login`, `register`, `verify-email`, `reset-password`: 5/min (brute-force protection — especially important for the 6-digit codes, which would be guessable without throttling)
  - `resend-verification`, `forgot-password`: 3/min (these trigger a real email — tighter to stop someone from email-bombing an arbitrary address)
- Exceeding a limit returns `429 Too Many Requests` automatically.

## 8. Email (`src/lib/mail/mail.service.ts`)

Wraps the [Resend](https://resend.com) SDK. Two methods: `sendVerificationEmail` and `sendPasswordResetEmail`, both sending a styled OTP email with the 6-digit code displayed prominently (large, letter-spaced, in a highlighted box) plus the code in the subject line. Send failures are caught and logged rather than thrown — a flaky email provider shouldn't turn into a `500` on registration; the user always has `resend-verification` as a fallback.

## 9. API docs

Swagger/OpenAPI is auto-wired via the `@nestjs/swagger` **CLI plugin** (`nest-cli.json` → `compilerOptions.plugins`), which infers most DTO schema from `class-validator` decorators and TypeScript types — no need to hand-annotate every field. Controllers add `@ApiTags`, `@ApiOperation` summaries, and `@ApiBearerAuth()` where a token is required.

Once the server is running: **`http://localhost:<PORT>/docs`** — a full interactive UI, including an "Authorize" button to paste in a bearer token for protected routes.

## 10. Environment variables (`.env`, template in `.env.example`)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string for Prisma |
| `PORT` | HTTP port |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES_IN` | access token signing key + TTL |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | refresh token signing key + TTL (keep this different from the access secret — a leaked access secret shouldn't let anyone mint refresh tokens) |
| `RESEND_API_KEY` | Resend API key |
| `MAIL_FROM` | from-address used on outgoing emails |
| `APP_URL` | base URL of the app — currently unused by the OTP email flow, kept for future link-building (e.g. a frontend URL in emails) |

## 11. Running it locally

```bash
# 1. Postgres (any local instance works, e.g. via Docker)
docker run --name auth-system-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=auth_system -p 5432:5432 -d postgres:16

# 2. Apply the schema
npx prisma migrate dev

# 3. Start the API
npm run start:dev
```

Then visit `http://localhost:3000/docs` to explore and try every route interactively.
