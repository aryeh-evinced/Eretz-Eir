# Security Checklist

**Last reviewed:** 2026-04-03
**Status:** Signed off for v1 staging

## Client Bundle Security

- [x] No `SUPABASE_SERVICE_ROLE_KEY` in client bundle (server-only in `lib/supabase/admin.ts`)
- [x] No `ANTHROPIC_API_KEY` in client bundle (server-only in `lib/ai/claude.ts`)
- [x] No `OPENAI_API_KEY` in client bundle (server-only in `lib/ai/openai.ts`)
- [x] Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` exposed to client (safe by design)
- [x] AI calls proxied through `/api/ai/*` route handlers — no direct client-to-provider calls

## HTTP Security Headers

- [x] `Content-Security-Policy` — restricts script sources, blocks framing, limits connect-src to Supabase
- [x] `X-Frame-Options: DENY` — prevents clickjacking
- [x] `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- [x] `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage
- [x] `Permissions-Policy` — disables camera, microphone, geolocation
- [x] Headers configured in both `next.config.ts` (app) and `vercel.json` (edge)

## Row-Level Security (RLS)

- [x] Players can only read their own row (`players` table)
- [x] Players can only read their own stats (`player_stats` table)
- [x] Game participants can only read their own game session
- [x] Non-participants cannot access game sessions they're not part of
- [x] Direct INSERT into `answers` is blocked for authenticated users
- [x] Direct UPDATE of `game_sessions` status is blocked
- [x] `rate_limits` table is completely blocked for authenticated users
- [x] `job_health` table is completely blocked for authenticated users
- [x] `heartbeat()` RPC only works for game participants
- [x] All policies verified by `supabase/tests/rls.test.sql` (12 tests)

## Input Sanitization

- [x] `sanitizeAnswer()` strips niqqud, geresh, control characters, and truncates to 30 chars
- [x] `isSuspiciousInput()` rejects prompt injection attempts in AI validation
- [x] Zod schemas validate all API inputs (`lib/validation/gameSchemas.ts`)
- [x] Room codes validated as exactly 4 digits

## Authentication & Authorization

- [x] All game mutation routes require authenticated Supabase user
- [x] Edge Functions validate service role key in Authorization header
- [x] Route handlers verify player is game participant before mutations
- [x] Host-only operations (start, end) check `created_by` field
- [x] Rate limiting per IP, per game, and concurrent request limits

## AI Security

- [x] No player identifiers sent in AI prompts (only game letter + answer text)
- [x] AI responses validated against strict Zod schema
- [x] Content safety filter (`contentSafety.ts`) applied to all AI-generated text
- [x] Circuit breaker prevents cascade failures from provider outages
- [x] Budget enforcement prevents runaway API costs
- [x] Concurrent request limiter prevents abuse

## Children's Data (ADR 0002)

- [x] No PII collected (no email, real name, DOB, location)
- [x] Anonymous auth only — no social login
- [x] No analytics SDKs, tracking pixels, or advertising
- [x] No third-party cookies
- [x] Log redaction prevents PII in structured logs
- [x] IP addresses hashed in logs, never stored raw
- [x] AI prompts/responses not persisted — in-memory only during request
- [x] Data retention windows defined and enforced by Edge Functions

## Credential Rotation

### Supabase Anon Key
- **Holder:** Project admin
- **Rotation:** Supabase dashboard > Project Settings > API > Generate new anon key
- **Downstream:** Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel env vars + GitHub secrets
- **Verification:** Hit `/api/health` after redeployment

### Supabase Service Role Key
- **Holder:** Project admin
- **Rotation:** Supabase dashboard > Project Settings > API > Generate new service role key
- **Downstream:** Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel env vars + GitHub secrets + Edge Function env
- **Verification:** Trigger any Edge Function manually, confirm 200

### Anthropic API Key
- **Holder:** Project admin
- **Rotation:** Anthropic Console > API Keys > Create new > Deactivate old
- **Downstream:** Update `ANTHROPIC_API_KEY` in Vercel env vars + GitHub secrets
- **Verification:** Submit a test answer for AI validation
- **Spend limit:** Set in Anthropic Console dashboard

### OpenAI API Key
- **Holder:** Project admin
- **Rotation:** OpenAI Platform > API Keys > Create new > Delete old
- **Downstream:** Update `OPENAI_API_KEY` in Vercel env vars + GitHub secrets
- **Verification:** Trigger AI validation with Claude circuit breaker open to force fallback
- **Spend limit:** Set in OpenAI usage dashboard

### Vercel API Token
- **Holder:** Project admin
- **Rotation:** Vercel dashboard > Settings > Tokens > Create new
- **Downstream:** Update `VERCEL_API_TOKEN` in GitHub secrets
- **Verification:** Trigger deploy workflow manually

## Sign-off

- **Reviewer:** stark-phase-execute (automated)
- **Date:** 2026-04-03
- **Scope:** v1 staging deployment
- **Note:** Production sign-off requires manual review by a human before the deploy workflow's production promotion gate will pass.
