# Eretz-Eir Implementation Plan

> **Synthesized from multi-agent design-to-plan review (2026-04-03)**
> - Base plan: **codex** (9.0/10) — 7 phases, 430 lines
> - Cross-reviewed by: gemini (scored codex 9.0/10), codex (scored gemini 5.0/10)
> - Claude agent: timed out (2/3 plans generated)
> - Synthesis fixes applied: Phase 2/3 parallelization, LocalStorage schema versioning, timer backstop UI transition
> - Plan execution review (round 1): 2 agents × 10 domains, 152 findings → classified and fixed below

## 1. Overview
Build the product in seven phases that keep the system usable after every checkpoint: first freeze the missing contracts and scaffold the Next.js/Tailwind/Zustand codebase around the existing design artifacts, then provision Supabase/Vercel infrastructure and the database schema, then ship a fully working solo game loop backed by LocalStorage and deterministic word-list fallbacks, then add server-authoritative multiplayer and realtime state sync, then layer in AI validation/hints/competitors with circuit breaking and manual review, and finally harden the system with statistics pipelines, scheduled maintenance, monitoring, and release gates. Key constraints from the design are non-negotiable: Hebrew-only RTL UI, server-authoritative scoring and validation, all AI calls proxied through API routes, explicit Supabase-backed rate limiting, and operational tasks implemented as scheduled jobs rather than comments.

### Effort sizing legend
- **S** = 1–3 developer-days (single engineer)
- **M** = 1–2 weeks (single engineer)
- **L** = 2–4 weeks (single engineer)

### Success criteria (release gates)
- P95 API response time < 500ms for game route handlers
- AI validation round-trip < 5s (including fallback)
- Concurrent game session target: 50 (v1)
- Playwright E2E pass rate ≥ 95% across 3 consecutive runs
- Unit/integration test pass rate = 100%
- Zero uncaught exceptions in staging logs for 1 hour post-deploy
- AI validation accuracy ≥ 90% agreement with human-labeled ground truth (Hebrew answer set)
- All scheduled Edge Functions have heartbeat within 2× their cron cadence

## 2. Prerequisites
- Resolve the following design gaps before coding:
  - Offline solo mode conflicts with mandatory Supabase anonymous auth. Adopt a local provisional player ID for offline solo, and lazily create/link the Supabase auth identity when online.
  - `REFRESH MATERIALIZED VIEW CONCURRENTLY` cannot run inside the `game_sessions` trigger. Replace trigger-side refresh with a queue table plus scheduled worker.
  - RLS cannot safely allow direct `UPDATE` on `game_players` if only `last_seen` should change. Replace direct table updates with a `heartbeat(game_id uuid)` RPC or `/api/game/heartbeat`.
  - Clients must not insert or update `answers` directly if the server is the scoring authority. Remove direct-write answer policies.
  - `game_players.rank` and `player_stats.fastest_answer_ms/strongest_category/weakest_category` need an explicit computation path before statistics work starts.
  - `SPEC.md` says room codes are `4-6` digits while `DESIGN.md` fixes them at `4` digits. Lock one value before UI and rate-limit work; recommend `4` digits for v1 because the rest of the design already assumes it.
- Required tools:
  - `node >= 22`
  - `pnpm >= 9`
  - `supabase CLI`
  - `vercel CLI` (install via `pnpm add -g vercel`, not Homebrew)
  - `terraform >= 1.8`
  - `docker` for `supabase start` (allocate ≥8 GB memory to Docker — the full local Supabase stack requires it)
- Required accounts/access (confirm all are active before Phase 1 begins):
  - Supabase project admin access — create project in dashboard or via `supabase projects create`, capture project ref and DB password for Terraform
  - Vercel project admin access
  - Anthropic API key (confirm quota/tier for expected usage)
  - OpenAI API key (confirm quota/tier for fallback usage)
- Bootstrap commands:
```bash
brew install node pnpm supabase/tap/supabase terraform
pnpm add -g vercel
supabase login
vercel login
# Note: `pnpm install` runs AFTER Phase 1 creates package.json
```
- Repository bootstrap targets:
  - `package.json`
  - `.env.example` (all required env vars with placeholder values)
  - `app/`
  - `components/`
  - `lib/`
  - `stores/`
  - `data/`
  - `scripts/`
  - `supabase/`
  - `infra/terraform/`
  - `tests/`
- Environment variables — scope by execution context:
  - **Client-safe (NEXT_PUBLIC_):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_BASE_URL`
  - **Server-only (route handlers, Edge Functions — never in client bundle):** `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AI_MONTHLY_BUDGET_USD`
  - **Feature gates (env-var toggles — wire into route handlers in Phase 2, not Phase 7):** `FEATURE_MULTIPLAYER_ENABLED=true`, `FEATURE_AI_ENABLED=true`. These are Vercel environment variables checked by route handlers at request time and available for rollback from Phase 4 onward.
  - Use separate credential values per environment: local dev uses local Supabase keys and test AI keys; staging and production use their own keys. Never share `SUPABASE_SERVICE_ROLE_KEY` between environments.
  - **Terraform provider inputs** (for `terraform plan/apply`): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `VERCEL_API_TOKEN`, `VERCEL_TEAM_ID` — store in CI secrets and `infra/terraform/terraform.tfvars` (gitignored)

## 3. Phases

## Phase 1: Contract Freeze And Repository Scaffold
**Goal:** Turn the design into an implementable repository with agreed contracts, toolchain, and directory layout.
**Dependencies:** None
**Estimated effort:** S

### Tasks
1. Freeze the unresolved architecture decisions.
   - Create `docs/adr/0001-core-contracts.md` and record the six prerequisite decisions above, plus the chosen room-code length and the offline identity model.
   - Create `docs/adr/0002-childrens-data-compliance.md`: define which jurisdictions apply (at minimum: Israel privacy law for the target audience), whether parental consent is required, what data is collected vs. avoided, retention windows for all table types, and how anonymous auth records are cleaned up. Treat compliance as a Phase 2 design input, not a Phase 7 afterthought. **Downstream enforcement:** Phase 2 schema must implement the retention windows from this ADR, Phase 2 `retention-cleanup` function must enforce them, Phase 7 log redaction must respect the data handling rules, and the Phase 7 security checklist must verify all ADR constraints are met.
   - Record the share-image technology decision: use **Satori + @resvg-wasm** (the canonical Vercel-compatible OG image approach). This avoids native-dependency failures (node-canvas) and 50–150MB bundle bloat (Puppeteer) in Vercel serverless.
   - Record the heartbeat implementation decision: specify whether heartbeat is an RPC only, a route only, or both, and document which components call which. The Prerequisites and Phase 4 currently use inconsistent language ("RPC or route" vs. "RPC/route plus presence-scan").
   - Update `DESIGN.md` only where the ADR changes the design contract.
   - Done when every unresolved design-review item has an approved resolution or a documented deferral with a specific re-evaluation date. The **offline identity model** and **room-code length** are hard blockers — they must be resolved (not deferred) before Phase 2 begins, because both affect the Phase 2 database schema.
2. Scaffold the Next.js application without overwriting the existing static demos.
   - Add `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.js`, `tailwind.config.ts`, `eslint.config.js`, `prettier.config.mjs`, `middleware.ts`.
   - Add `.env.example` with all required environment variables (client-safe, server-only, feature gates, Terraform inputs) stubbed to placeholder values.
   - Add `vitest.config.ts` and `vitest` to dev dependencies. Define `pnpm test` script alias in `package.json`. Define `pnpm typecheck` script as `tsc --noEmit`.
   - Add `playwright.config.ts` and `@playwright/test` to dev dependencies. Add `pnpm exec playwright install --with-deps chromium` to a `postinstall` script or document it in the bootstrap sequence.
   - Add `lib/observability/logger.ts` (structured JSON logger with a **log redaction contract**: explicitly forbid raw Authorization headers, cookies, service-role keys, full request bodies, and raw AI prompts/responses) and `lib/observability/requestId.ts` (request-scoped ID propagation). These are needed from Phase 2 onward — not Phase 7.
   - Add `lib/middleware/featureGates.ts` — a middleware helper that checks `FEATURE_MULTIPLAYER_ENABLED` and `FEATURE_AI_ENABLED` env vars and returns structured degradation responses. Wire into `middleware.ts`. This must exist before Phase 4 so the rollback plan's feature-flag references are functional.
   - Create empty folders and initial files for `app/`, `components/`, `lib/`, `stores/`, `data/`, `scripts/`, `tests/`, `supabase/`, `infra/terraform/`.
   - Add `supabase/config.toml` with project configuration (auth settings, Edge Function config, etc.) — `supabase start` uses defaults without it.
   - Add `.tfstate`, `.tfstate.backup`, `.env.local`, `.env.test` to `.gitignore`. Add `.nvmrc` or `engines` field in `package.json` to pin Node version.
   - Preserve `index.html`, `home-demo.html`, and `profile-demo.html` as design references until React equivalents pass their E2E smoke tests in Phase 3. Remove them as a Phase 3 sub-task.
   - Done when `pnpm install`, `pnpm dev`, `pnpm lint`, and `pnpm test` (with a trivial passing test) run successfully on a clean clone.
3. Establish the shared TypeScript contracts and file boundaries.
   - Add `lib/types/game.ts`, `lib/types/api.ts`, `lib/types/ai.ts`, `lib/constants/categories.ts`, `lib/constants/letters.ts`.
   - Define the API envelope types matching the design: `ApiSuccess<T>`, `ApiError`, `GameSession`, `Round`, `Answer`, `PlayerProfile`.
   - Define `data/word-lists.json` schema in `lib/types/game.ts`: `Record<HebrewLetter, Record<Category, string[]>>`. Specify minimum coverage: all valid Hebrew game letters × all 8 standard categories × ≥10 words each.
   - Define the `sanitizeAnswer(text: string): string` contract: strip control characters, excessive whitespace, niqqud normalization; enforce max 30 characters per answer. This contract is used by both Phase 4 (server-side input validation) and Phase 5 (AI prompt safety).
   - Add function stubs matching the design signatures:
     - `lib/ai/provider.ts::async function callAI(prompt: string, systemPrompt: string): Promise<string>`
     - `lib/game/scoring.ts::function scoreAnswer(answer: ValidatedAnswer, allAnswers: ValidatedAnswer[]): AnswerScore`
     - `lib/game/normalization.ts::function fuzzyMatch(a: string, b: string): boolean`
     - `lib/game/difficulty.ts::function adjustDifficulty(state: DifficultyState, competitors: AICompetitor[]): AICompetitor[]`
     - `lib/game/validator.ts::async function validateAnswers(answers: RoundAnswers): Promise<ValidationResult>` — the validation interface that Phase 4 calls with the word-list fallback and Phase 5 replaces with AI
   - Done when application, API, and test layers compile against the same type definitions.

### Risks
- Bootstrap drift from the approved design: lock the contracts in ADRs before generating files.
- Static prototype assets getting overwritten: keep them outside `app/` and treat them as read-only reference inputs.

### Verification
```bash
pnpm install
pnpm lint
pnpm test
```

## Phase 2: Infrastructure Provisioning And Database Foundation
**Goal:** Provision Supabase/Vercel infrastructure, ship the base schema, configure auth, and make migrations and scheduled jobs reproducible.
**Dependencies:** Phase 1
**Estimated effort:** M

> **Task execution order within this phase:** Tasks are numbered for reference but must be executed in dependency order: Task 1 (provisioning) → Task 2 (schema/auth) → Task 3 (Edge Function code deployment) → Task 5 (schedule activation) → Task 4 (client wiring) → Task 6 (test fixtures). Schedules must not be activated before their target functions and backing tables exist.

### Tasks
1. Provision cloud resources and environment wiring as code.
   - **Pre-Terraform bootstrap (one-time manual step):** Create the Supabase project in the dashboard or via `supabase projects create`. Capture the project ref and DB password into `infra/terraform/terraform.tfvars` (gitignored). The Supabase Terraform provider requires an existing project ref — it cannot create a project from scratch.
   - Add `infra/terraform/main.tf` (with **remote state backend** — Terraform Cloud free tier or an S3/GCS bucket with encryption; add bootstrap steps to `infra/scripts/bootstrap.sh` for backend initialization), `infra/terraform/supabase.tf`, `infra/terraform/vercel.tf`, `infra/terraform/variables.tf`, `infra/terraform/outputs.tf`.
   - **Staging vs. production:** use Terraform workspaces or separate `.tfvars` files for staging and production. Each environment gets its own Supabase project and Vercel project. Document the separation in `infra/README.md`.
   - Provision:
     - Supabase project configuration (auth settings, site URL, redirect config)
     - Vercel project and environment variables (scoped: client-safe vs. server-only)
   - **Note:** Edge Function scheduling is handled via `pg_cron` in Task 5 (SQL migration), not Terraform — the Supabase Terraform provider has no resource type for Edge Function schedules.
   - If Terraform coverage is incomplete for a target, add a documented bootstrap script at `infra/scripts/bootstrap.sh` with **idempotent create-or-update semantics** (existence check before creation to prevent duplicates on re-run). For every non-Terraform resource, emit a verification step that asserts the expected state via API call, and add that check to CI for drift detection.
   - Done when staging can be recreated from the repo without manual dashboard-only setup, and `terraform plan` shows no drift.
2. Create the initial Postgres schema, configure auth, and establish the safe RLS model.
   - **Enable anonymous sign-in** on the Supabase project (via dashboard, Terraform, or bootstrap script). This is a hard dependency for Phase 3 online linking and all Phase 4 authenticated routes.
   - Add `supabase/migrations/0001_core_tables.sql` for `players`, `player_stats`, `game_sessions`, `game_players`, `rounds`, `answers`, `rooms`, `rate_limits`, `stats_refresh_queue`, `job_health`. **Enable required extensions:** `CREATE EXTENSION IF NOT EXISTS pg_cron;` and `CREATE EXTENSION IF NOT EXISTS pg_net;` (needed for Edge Function invocation from cron).
   - **Configure Supabase connection pooling** for serverless: enable PgBouncer transaction pooling via Supabase dashboard or `supabase/config.toml`. Document the pooler connection string and ensure all serverless route handlers use it. This is critical to avoid connection exhaustion at the target 50 concurrent games.
   - Add `supabase/migrations/0002_indexes.sql` for hot-path indexes, including active-round and active-room indexes. Add a **unique constraint on `rooms.code` scoped to active rooms** (`WHERE status != 'finished'`) to prevent room-code collisions.
   - Add `supabase/migrations/0003_policies.sql` that:
     - permits player profile self-management
     - blocks direct `answers` writes from clients
     - blocks direct game-state mutations from clients
     - exposes read scopes only to participants
     - **blocks all client access to `rate_limits`** (SELECT, INSERT, UPDATE, DELETE denied for anon and authenticated roles — only service-role connections may access this table)
     - **blocks all client access to `job_health`**
   - Add `supabase/migrations/0004_rpc.sql` for `increment_or_reset(...)`, `heartbeat(game_id uuid)`, and any helper RPCs needed for rate limiting or safe presence updates.
   - **Enable Supabase Realtime publication** via a migration (add to `0004_rpc.sql` or a dedicated `0004b_realtime.sql`): `ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions, game_players, rounds, rooms;` and set `REPLICA IDENTITY FULL` on tables where UPDATE/DELETE payloads are needed. This is a hard dependency for Phase 4 realtime subscriptions.
   - **For each forward migration, write and commit a corresponding down migration** (e.g., `0001_core_tables_down.sql`). Test the round-trip: `supabase db reset` → apply all → run down migrations → `supabase db reset` again. Rollback SQL is a Phase 2 deliverable, not an incident-time improvisation.
   - Done when `supabase db reset` produces a working schema, anonymous sign-in works, Realtime publication is active, the service role is only needed inside route handlers or Edge Functions, and down migrations pass a round-trip test.
3. Deploy operational Edge Functions as stubs with logging and health tracking.
   - Add `supabase/functions/room-cleanup/index.ts`, `supabase/functions/round-backstop/index.ts`, `supabase/functions/presence-scan/index.ts`, `supabase/functions/stats-refresh/index.ts`, `supabase/functions/retention-cleanup/index.ts`.
   - **Phase 2 implementations are stubs:** each function logs a structured heartbeat event (`{job: 'round-backstop', status: 'ok', message: 'stub — real implementation in Phase 4'}`) and writes a `last_success_at` timestamp to the `job_health` table. Real business logic is added in the phase that creates their dependencies (round-backstop and presence-scan in Phase 4, stats-refresh in Phase 6).
   - **Authentication model:** each function must verify a service-to-service auth header (a per-job signed secret or platform-managed identity) on every invocation. Document the identity creation, secret storage, and rotation procedure. Do not use `--no-verify-jwt` in production.
   - Each function emits structured log events: `{job: '<name>', status: 'ok'|'error', error?: '...', duration_ms: N}`.
   - Done when each function deploys, runs, logs its heartbeat, and writes to `job_health`. Actual scheduling is activated in Task 5.
4. Wire Supabase clients and health checks into the app.
   - Add `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/health.ts`.
   - Add `app/api/health/route.ts` — a server-side health endpoint that checks Supabase connectivity, returns component statuses as structured JSON, and is usable by external uptime monitors (Vercel checks, BetterUptime, etc.). The existing client-side health probe can call this endpoint.
   - The health probe should also query `job_health` to confirm scheduled functions have run within their expected cadence, and expose a `multiplayer_ready` flag that gates multiplayer UI.
   - Done when local and staging environments can sign in anonymously online, the health endpoint returns structured status, and the app can distinguish `online-multiplayer-ready` from `solo-only` mode.
5. Activate cron schedules for operational jobs.
   - Add `supabase/migrations/0005_cron_schedules.sql` that creates schedule entries. **Bootstrap prerequisite:** this migration must first set the Postgres custom settings used for Edge Function invocation:
     ```sql
     ALTER DATABASE postgres SET app.supabase_url = 'http://127.0.0.1:54321';  -- local; overridden per environment
     ALTER DATABASE postgres SET app.service_role_key = '...';  -- set via bootstrap script per environment
     ```
     **Invocation path:** pg_cron jobs invoke Edge Functions via `pg_net` HTTP POST: `SELECT cron.schedule('round-backstop', '* * * * *', $$ SELECT net.http_post(url := current_setting('app.supabase_url') || '/functions/v1/round-backstop', headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key'))) $$);`
     The bootstrap script (`infra/scripts/bootstrap.sh`) must set these per-environment custom settings after each `supabase db reset` or deployment. Add this to the Phase 2 verification checklist.
   - Schedule cadences:
     - every 15 minutes: room cleanup
     - **every 1 minute**: round backstop — accept 60s backstop tolerance (pg_cron minimum is 1 minute). Update Phase 4 client-side timer assumptions to expect up to ~65s worst-case (60s cron + 5s cold-start). The secondary client-side recovery path (Phase 4 Task 4) provides the sub-minute safety net.
     - **every 1 minute**: presence scan / host transfer
     - every minute: stats refresh queue drain
     - monthly: retention cleanup
   - Use deterministic schedule names plus existence checks (`INSERT ... ON CONFLICT DO UPDATE`) to prevent duplicate schedules on re-run.
   - Done when `psql -c "SELECT * FROM cron.job;"` shows all expected schedules, and each scheduled function has at least one observed successful invocation in local/staging with the expected `job_health` timestamp update.
6. Bootstrap test fixtures for verification.
   - Add `tests/scripts/seed-e2e-tokens.sh` that: creates two anonymous Supabase auth users, captures their JWTs, seeds minimal game state, and exports `E2E_PLAYER_TOKEN`, `E2E_PLAYER2_TOKEN`, and `SUPABASE_TEST_PLAYER_TOKEN` to `.env.test` (gitignored).
   - Add `tests/fixtures/create-game.json` and other fixture files (UTF-8 encoded) to avoid inline Hebrew in curl commands.
   - Done when running the seed script on a fresh `supabase db reset` produces valid tokens that can be used in the verification commands below.

### Risks
- Over-permissive RLS can silently undermine server authority: enforce writes through API/service-role paths only.
- Terraform provider gaps can stall provisioning: keep a scripted fallback with drift detection and track every manual step as debt.
- Scheduled jobs can race with API transitions: make every function idempotent and predicate all writes on current row state.
- **Edge Function stubs that silently fail will mask scheduling problems.** The `job_health` table and health endpoint together provide the detection signal — verify it works before Phase 4 begins.

### Verification
```bash
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform plan
terraform -chdir=infra/terraform apply  # manual approval gate for first run
supabase start
supabase db reset
psql "$DATABASE_URL" -c "SELECT * FROM cron.job;"  # verify all 5 schedules exist
bash tests/scripts/seed-e2e-tokens.sh  # bootstrap test tokens → writes .env.test
source .env.test
supabase functions serve  # note: use --no-verify-jwt only for local debugging, not as default
curl -i http://127.0.0.1:54321/rest/v1/players -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $E2E_PLAYER_TOKEN"
curl -i http://localhost:3000/api/health  # verify health endpoint returns structured status
```

## Phase 3: Profile, Layout, And Solo-Mode Foundation
**Goal:** Ship a usable RTL application shell, profile persistence, and local-only solo state recovery without multiplayer or AI dependencies.
**Dependencies:** Phase 1 (Phase 2 infra tasks can run in parallel with Phase 3 UI tasks — see note below)
**Estimated effort:** M

> **Parallelization note — refined boundaries:**
> - **Tasks 1 and 2 (offline parts only)** may run freely in parallel with Phase 2, since they depend only on Phase 1 types.
> - **Task 2 online identity linking** (the `app/api/player/route.ts` and Supabase-auth UUID linkage) is blocked on Phase 2 Task 4 (Supabase client wiring). Start the offline profile work in parallel; integrate online linking as a follow-up sub-task once Phase 2 Task 4 passes its verification gate.
> - **Tasks 3 and 4** (game store, solo gameplay) use LocalStorage only and can also proceed in parallel with Phase 2.
> - Phase 3 Tasks 3 and 4 should not start until Phase 2 Task 2 schema has passed verification (`supabase db reset` produces working schema, RPC stubs callable) — even though they don't directly use Supabase, the schema defines the data shapes that local storage must mirror.

### Tasks
1. Build the RTL shell and shared UI primitives.
   - Implement `app/layout.tsx`, `app/page.tsx`, `app/setup/page.tsx`, `components/ui/{Button,Input,Card,Timer,Modal,Avatar,Badge,Spinner}.tsx`.
   - Apply `lang=”he”` and `dir=”rtl”` at the root, configure Heebo/Rubik font loading, and encode the accessibility requirements into the base components.
   - Remove static HTML demos (`index.html`, `home-demo.html`, `profile-demo.html`) once the corresponding React routes pass their keyboard-navigation smoke checks.
   - Done when the home/setup flows match the static demos and pass keyboard-only navigation checks.
2. Implement profile storage with offline-first identity.
   - Add `stores/playerStore.ts`, `lib/storage/localPlayer.ts`, `app/api/player/route.ts`, `components/profile/{ProfileForm,StatsDisplay,GameHistory}.tsx`.
   - Use a locally generated UUID as the **stable local subject ID** that never changes. Store the Supabase-auth UUID as a linked secondary identifier. Do not replace the local ID — this prevents orphaning saved state (history, in-progress games, stats) when the user comes online.
   - **Identity linking state machine:** define three states in localStorage alongside the player record: `unlinked` → `link_pending` → `linked | link_failed`. On subsequent sessions, resume from the persisted state rather than re-deriving intent. Add an integration test for the `link_failed` → retry path.
   - **Follow-up sub-task (gated on Phase 2 Task 4):** integrate the Supabase anonymous auth linkage end-to-end. Add `tests/e2e/profile-online-link.spec.ts` that starts offline, brings Supabase online, reloads, and asserts game history is accessible under the linked identity. This must pass before Phase 4 begins.
   - Done when a first-time user can create a profile offline, reload the app, and keep the same local profile. The online linking path is explicitly marked as a stub until Phase 2 completes.
3. Implement the solo game state store and crash recovery contract.
   - Add `stores/gameStore.ts`, `lib/storage/localGame.ts`, `lib/game/session.ts`, `lib/game/letters.ts`, `lib/game/categoryPool.ts`.
   - Persist `eretz-eir:player`, `eretz-eir:settings`, `eretz-eir:games`, and `eretz-eir:current-game` exactly as the design requires.
   - **LocalStorage schema versioning:** Include a `schemaVersion: number` field in the `eretz-eir:current-game` payload. On hydration, validate the stored state against a Zod schema matching the current version.
   - **Forward-migration, not deletion:** implement migration functions for each schema version increment. For additive changes (new optional fields), apply defaults. Reserve state deletion only for structurally incompatible changes. Add an E2E test that loads a fixture with the previous schema version and verifies the game continues rather than resetting.
   - **Schema Migration Protocol (applies to all future phases):** any change that adds or removes fields from `eretz-eir:current-game` must bump `schemaVersion`, update the Zod schema, and include a migration function or an explicit incompatibility message. Enforce via PR checklist.
   - Add the “continue game?” recovery dialog and make sure interrupted rounds restore correctly from local state.
   - Done when solo state survives refreshes and browser restarts without network access.
4. Ship deterministic solo gameplay before AI.
   - Add `data/word-lists.json` with coverage validated by `scripts/validate-word-list.ts`: all valid Hebrew game letters (from `lib/constants/letters.ts`) × all 8 standard categories × ≥10 words each. This file also serves as the Phase 5 budget-exhaustion fallback — it must be production-quality, not placeholder.
   - Add a deterministic local validator/generator path in `lib/game/fallbackWords.ts` that implements the `validateAnswers` interface from Phase 1 Task 3.
   - Implement `app/game/[id]/page.tsx`, `components/game/{LetterDisplay,CategoryCard,CategoryGrid,HelpButton,DoneButton,PlayerBar,PlayerChip,CompetitorProgress}.tsx`.
   - Add `tests/e2e/solo-offline.spec.ts` as part of this task (the testing strategy says “smoke E2E in Phase 4” but this Phase 3 test covers offline-only solo, which is entirely local).
   - Use word-list mode for local-only solo rounds so the end-to-end solo loop works before AI or Supabase is involved.
   - Done when a full solo game can be played, scored, ended, and shown in history using only LocalStorage.

### Risks
- Offline identity linking can duplicate profiles when the client later comes online: the stable-local-ID + link-state-machine approach prevents this, but test the `link_failed` retry path explicitly.
- Accessibility regressions will be expensive to retrofit: encode focus, labels, live regions, and reduced-motion behavior in base components now.
- **LocalStorage migration functions must be present before the first schema version bump ships.** A deployment that bumps schemaVersion without a migration silently deletes in-progress games for every active player.

### Verification
```bash
pnpm dev
pnpm vitest tests/unit/storage tests/unit/game
pnpm tsx scripts/validate-word-list.ts  # verify word-list coverage
pnpm playwright test tests/e2e/solo-offline.spec.ts
pnpm playwright test tests/e2e/profile-online-link.spec.ts  # after Phase 2 Task 4 completes
```

## Phase 4: Server-Authoritative Game Engine And Multiplayer Realtime
**Goal:** Move game-state authority to the server for multiplayer, including lobby flows, legal state transitions, timer backstops, and reconnection handling.
**Dependencies:** Phases 1-3 + Phase 2 Task 5 (cron schedules must have observed successful invocations before multiplayer is enabled)
**Estimated effort:** L

> **Stabilization gate:** Before Phase 5 begins, Phase 4 must run in staging with no critical errors for ≥4 hours. The health endpoint's `job_health` checks for round-backstop and presence-scan must show consistent heartbeats throughout this window.

### Tasks
1. Implement the core server game engine and transaction boundaries.
   - Add `lib/game/stateMachine.ts`, `lib/game/submitRound.ts`, `lib/game/uniqueness.ts`, `lib/game/ranking.ts`, `lib/rateLimit.ts`.
   - Centralize legal transitions for `waiting -> playing -> reviewing|manual_review -> completed -> finished`.
   - Ensure uniqueness calculation, `submitted_at`, speed bonus, and per-answer scores are computed in one server transaction after answer collection closes.
   - **ranking.ts contract split:** define explicitly which ranking behaviors are final in Phase 4 (in-round scoring, speed bonus) vs. which are stubs to be finalized in Phase 6 (game_players.rank persistence, post-game aggregation). Mark stubs in code. Phase 6 must re-run all Phase 4 game-route tests after finalization.
   - **Input validation on every client-facing route:** use server-side Zod schemas with strict allowlists and max-length limits for room codes, answers, categories, and hint text. Apply `sanitizeAnswer()` from Phase 1 contracts. Reject payloads exceeding limits before they reach the database or AI layer.
   - Done when game actions are rejected on illegal transitions, no scoring field depends on client timestamps, and all inputs are validated at the API boundary.
2. Implement authenticated route handlers for all game actions.
   - Add `app/api/game/{create,join,start,done,next-round,timer-expired,end,review}/route.ts`, `app/api/game/[id]/route.ts`, and `app/api/game/heartbeat/route.ts` if RPC-only heartbeat is not enough.
   - Route handlers must authenticate the caller, enforce IP and per-session rate limits via `rate_limits`, and use the service role only where required.
   - **Room code collision handling in create:** retry with a new code up to 5 times on unique-constraint violation before surfacing an error. Emit a metric on every collision retry for keyspace monitoring.
   - **Rate limiting on /api/game/join:** enforce ≤5 failed attempts per IP per 5-minute window with progressive backoff. Log enumeration attempts. This is critical for a children's game where 4-digit room codes (10,000 combinations) are vulnerable to brute-force.
   - **done/route.ts and timer-expired/route.ts** must call the deterministic fallback validator (`lib/game/fallbackWords.ts`) through the `validateAnswers` interface from Phase 1 Task 3. Phase 5 will replace this with AI validation as a drop-in, not a behavioral change.
   - Wire `lib/observability/logger.ts` (from Phase 1) into all route handlers with request ID propagation.
   - Done when every route returns the standard `{ ok, data|error }` envelope and only the host can call host-only actions.
3. Add lobby, join, and realtime synchronization.
   - Implement `app/lobby/[code]/page.tsx`, `app/join/[code]/page.tsx`, `components/lobby/{RoomCode,ShareLink,PlayerList}.tsx`.
   - Add `lib/realtime/gameChannel.ts` to subscribe to `game:{game_id}` and normalize `player_joined`, `player_left`, `round_start`, `player_done`, `round_end`, `answers_revealed`, `host_changed`, `game_over`.
   - Verify that Realtime publication (configured in Phase 2 Task 2) delivers expected events between two clients.
   - Done when two browsers can create, join, and observe the same lobby and round state without direct client table writes.
4. Implement disconnect handling and host transfer.
   - Use the heartbeat RPC/route plus `presence-scan` to mark disconnected players, auto-transfer host after 60 seconds, and score abandoned players correctly after 5 minutes.
   - **Upgrade round-backstop and presence-scan** from Phase 2 stubs to real implementations now that `stateMachine.ts` and the route handlers exist.
   - **Secondary recovery path for round-backstop failure:** if a player's `timer-expired` POST receives no state-transition confirmation within 90 seconds, the route handler should unconditionally transition the round using an idempotent conditional `UPDATE WHERE status='playing'`. This makes each client a fallback trigger, not just the cron. Emit an alertable metric for rounds remaining in `playing` status beyond `timer_seconds + 120` seconds.
   - Add announcement wiring to the game store and `aria-live` regions.
   - Add `docs/runbooks/stuck-round-recovery.md` and `docs/runbooks/host-transfer-failure.md` — write runbooks in the phase that introduces the failure mode, not Phase 7.
   - Done when reconnection restores state correctly, host transfer occurs exactly once, and the secondary backstop recovery path is tested.

### Risks
- Mixed client/server writes can create race conditions: enforce a single server mutation path for all authoritative state.
- Realtime can mask missing persistence guarantees: treat channel events as notifications only and always rehydrate state from Postgres after critical actions.
- Timer expiry can double-fire from clients and cron: make `timer-expired` idempotent and conditional on `rounds.status = 'playing'`.
- Timer backstop UI hang: if a client's local timer reaches zero but the server hasn't transitioned the round yet (up to ~65s worst-case: 60s cron cadence + 5s cold-start), the UI should optimistically transition to a "waiting for results..." state rather than hanging on a dead timer. The client calls `POST /api/game/timer-expired` and shows a loading state. The client loading-state timeout should be at least 90 seconds before escalating to a user-visible error (to allow for the secondary recovery path).

### Verification
```bash
# Run seed script first to populate tokens
source .env.test

curl -i -X POST http://localhost:3000/api/game/create \
  -H "Authorization: Bearer $E2E_PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/create-game.json

# Capture GAME_ID from response:
GAME_ID=$(curl -s -X POST http://localhost:3000/api/game/create \
  -H "Authorization: Bearer $E2E_PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/create-game.json | jq -r '.data.id')

curl -i -X POST http://localhost:3000/api/game/join \
  -H "Authorization: Bearer $E2E_PLAYER2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"'"$(curl -s http://localhost:3000/api/game/$GAME_ID -H "Authorization: Bearer $E2E_PLAYER_TOKEN" | jq -r '.data.room.code')"'"}'

curl -i -X POST http://localhost:3000/api/game/start \
  -H "Authorization: Bearer $E2E_PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"game_id":"'"$GAME_ID"'"}'

pnpm vitest tests/integration/api/game-routes.test.ts
pnpm playwright test tests/e2e/multiplayer-room.spec.ts
```

## Phase 5: AI Layer, Manual Review, And Budget Controls
**Goal:** Replace deterministic fallbacks with provider-backed AI flows while keeping the system safe under latency, outage, and budget pressure.
**Dependencies:** Phases 1-4
**Estimated effort:** L

> **Stabilization gate:** Before Phase 6 begins, Phase 5 must run in staging for ≥2 hours with no critical errors.

> **Go/no-go gate:** Before enabling AI validation for all rounds, run a fixed evaluation set of Hebrew answers through the validation endpoint and require ≥90% agreement with human-labeled ground truth. Automate this as `tests/eval/ai-validation-accuracy.test.ts`. **Ground truth creation:** curate `tests/eval/ground-truth.json` with ≥100 Hebrew answer/category/letter/expected-validity triples, reviewed for age-appropriateness. Budget 1 day for curation as a Phase 5 prerequisite task.

### Tasks
1. Implement the provider abstraction and circuit breaker exactly once.
   - Implement `lib/ai/provider.ts`, `lib/ai/claude.ts`, `lib/ai/openai.ts`, `lib/ai/circuitBreaker.ts`.
   - Persist provider failure counts and `open_until` in `rate_limits` under the `circuit:claude` key. If this requires new columns beyond the Phase 2 schema, add them via `supabase/migrations/0006_circuit_breaker.sql` — do not retroactively modify Phase 2 migrations.
   - Enforce the designed timeout and retry behavior before fallback.
   - **Fail-closed behavior:** if the circuit breaker state cannot be read from Supabase (degraded DB), default to word-list mode — never allow unmetered AI calls when the rate-limit/circuit-breaker infrastructure is unavailable. Document this as an explicit design decision.
   - Done when Claude failures route traffic to OpenAI without adding repeated timeout latency.
2. Implement structured AI validation, hinting, and competitor generation.
   - Implement `lib/ai/validate.ts`, `lib/ai/generate.ts`, `lib/ai/prompts.ts`, `lib/ai/schema.ts`.
   - Implement `app/api/ai/hint/route.ts` for `mode: "hint" | "fill"` using the `sanitizeAnswer()` contract from Phase 1 Task 3.
   - **Prompt injection mitigation:** user-submitted Hebrew answers must never be inlined with instruction text. Use structured prompting with a fixed system prompt and user content in a clearly bounded JSON data section. Enforce max 30 characters per answer (from `sanitizeAnswer()`) before content reaches the AI layer. Reject answers matching suspicious patterns.
   - **Content safety filter:** add a post-generation check in `lib/ai/validate.ts` that filters AI-generated text (competitor answers, hints) against a blocklist or moderation API call before display. This is especially warranted given the 9-year-old primary user.
   - Route all round-end validation through server-internal functions invoked by `done/route.ts` and `timer-expired/route.ts`, replacing the Phase 4 word-list validator as a drop-in via the `validateAnswers` interface.
   - Done when validation, hints, and competitor answers all return schema-validated JSON and reject malformed model output.
3. Implement manual review and failure degradation.
   - Add `components/results/{ResultsTable,AnswerCell,SpeedBonusIcon,HelpUsedIcon}.tsx` and host-only review controls in `app/game/[id]/results/page.tsx`.
   - Add server logic that moves rounds into `manual_review`, stores host decisions, auto-accepts timed-out review items after two minutes, and uses optimistic letter-only acceptance in solo mode if both providers are down.
   - **Manual-review timeout must be independent of round-backstop:** implement it as a separate scheduled query or a condition checked by the `timer-expired` and `done` route handlers, not as part of the round-backstop Edge Function. This avoids a single-point-of-failure where one function failure blocks both round completion and manual-review resolution.
   - Add `docs/runbooks/ai-circuit-breaker-reset.md` and `docs/runbooks/manual-review-queue-drain.md`.
   - Done when total provider outage still lets a round finish without deadlocking the game.
4. Implement cost and concurrency controls.
   - Add `supabase/migrations/0007_rate_limits_ai_budget.sql` to extend `rate_limits` with any new columns needed for AI-specific rate limits and budget tracking.
   - Extend `rate_limits` usage for:
     - per-IP AI requests
     - per-game AI call counts
     - global concurrent AI calls
     - per-round help limits
     - monthly budget enforcement
   - **Monthly budget must be tracked as a running total in Postgres** (not in-process state). Vercel serverless functions are stateless with many concurrent instances — in-process budget tracking will overspend by a factor of concurrent instances. Increment the budget counter atomically using token-count metadata from each AI API response.
   - **Pre-exhaustion alerts:** add a scheduled check (can piggyback on stats-refresh) that compares cumulative AI spend against `AI_MONTHLY_BUDGET_USD` and emits alerts at 80% (dashboard warning) and 95% (page-level alert). This gives operators time to decide whether to raise the budget before players experience degradation.
   - Add `lib/ai/budget.ts` and dashboard-facing metrics/logging in `lib/observability/ai.ts`.
   - Done when the app cleanly switches to word-list mode after budget exhaustion and emits logs for every degraded path.

### Risks
- Output-schema drift from the models can corrupt scoring: reject any response that fails Zod validation and fall back immediately.
- Manual review can become a dead-end state: enforce the two-minute timeout on the server, not the client, and independently of the round-backstop function.
- AI features can hide rate-limit bugs until production: test with concurrent players and forced provider failures locally.
- **Prompt injection is the primary security risk in Phase 5.** The `sanitizeAnswer()` contract, max-length enforcement, and structured prompting together form the defense. Test with adversarial inputs in the evaluation suite.

### Verification
```bash
source .env.test  # load E2E tokens and IDs from seed script

curl -i -X POST http://localhost:3000/api/ai/hint \
  -H “Authorization: Bearer $E2E_PLAYER_TOKEN” \
  -H “Content-Type: application/json” \
  -d @tests/fixtures/hint-request.json

curl -i -X POST http://localhost:3000/api/game/done \
  -H “Authorization: Bearer $E2E_PLAYER_TOKEN” \
  -H “Content-Type: application/json” \
  -d @tests/fixtures/done-request.json

pnpm vitest tests/unit/ai tests/integration/ai-fallback.test.ts
pnpm vitest tests/eval/ai-validation-accuracy.test.ts  # go/no-go gate: ≥90% accuracy
pnpm playwright test tests/e2e/manual-review.spec.ts
```

## Phase 6: Statistics, History, Game Over, And Sharing
**Goal:** Compute durable post-game statistics, surface history/profile views, and finish the end-of-game experience.
**Dependencies:** Phases 1-5
**Estimated effort:** M

### Tasks
1. Implement post-game aggregation and rank assignment.
   - Finalize `lib/game/ranking.ts`, `lib/game/finalScore.ts`, `lib/stats/rebuildPlayerStats.ts`.
   - Add migrations for any missing derived fields or helper tables required by ranking and stats refresh.
   - Compute and persist `game_players.rank` during game finalization, then enqueue affected players in `stats_refresh_queue`.
   - **Backfill step:** add a one-time migration or script that recomputes ranks and enqueues all historical finished games (from Phases 4-5) before the stats surfaces go live. Games completed before Phase 6 have no persisted rank — the backfill prevents missing data in leaderboards.
   - **Re-run all Phase 4 game-route tests** after ranking finalization to catch regressions from contract changes.
   - Done when every finished game has stable ranks and player stat recomputation is deterministic.
2. Replace trigger-side materialized view refresh with an async refresh pipeline.
   - Add `supabase/migrations/0008_stats_pipeline.sql` to:
     - **Create `player_category_stats` materialized view** with a `CREATE MATERIALIZED VIEW` statement and a **unique index** (required for `REFRESH ... CONCURRENTLY`)
     - Enqueue player IDs on relevant game finalization events
     - Expose a `refresh_player_stats(player_ids uuid[])` function
   - Upgrade `supabase/functions/stats-refresh/index.ts` from Phase 2 stub to real implementation: drain the queue, recompute `player_stats`, then run `REFRESH MATERIALIZED VIEW CONCURRENTLY player_category_stats`. **Ordering constraint:** migration 0008 must be applied before the upgraded function is deployed. Pause the stats-refresh cron schedule, apply the migration, deploy the function, then re-enable the schedule.
   - **Advisory lock / single-flight guard:** use `pg_advisory_xact_lock` to prevent overlapping refreshes. If a refresh is already running, skip and log rather than stack. Define a freshness SLO (e.g., stats stale for ≤2 minutes) rather than forcing every invocation to refresh.
   - **Pre-read-cutover gate:** before enabling profile/leaderboard surfaces (Task 3), backfill a representative dataset, verify row counts and per-player aggregates against source game data, and require the refresh queue to drain cleanly for a defined soak window.
   - Done when stats refreshes succeed outside the write transaction and can be safely retried.
3. Ship profile, history, leaderboard, and game-over surfaces.
   - Implement `app/gameover/[id]/page.tsx`, `components/gameover/{Leaderboard,StatHighlight,ShareButton}.tsx`, `components/profile/GameHistory.tsx`.
   - Clarify in the UI that solo history is local-only in v1 while multiplayer profile stats are cloud-backed.
   - Done when the player can finish a game, see rankings and highlights, and revisit history later.
4. Implement share generation and exported result artifacts.
   - Use **Satori + @resvg-wasm** (decided in Phase 1 ADR) for server-side image generation — the canonical Vercel-compatible approach with no native dependencies and fast cold starts.
   - Add `lib/share/renderResultImage.ts` and dynamic imports for share-only code paths.
   - Add cold-start and bundle-size benchmarks as acceptance criteria.
   - Ensure WhatsApp-friendly output for the final results image or link.
   - Done when the share action works without inflating the initial game bundle.

### Risks
- Stats divergence between local solo and cloud multiplayer can confuse users: label each stats source explicitly.
- Async refresh lag can make profiles briefly stale: show “last updated” metadata and accept up-to-one-job-cycle delay.
- **Minute-by-minute full materialized-view refresh can overload the primary database** at scale. The advisory lock and freshness SLO prevent stacking; at higher volume, consider incremental aggregates or a read replica.
- Add `docs/runbooks/stats-refresh-queue-backlog.md`.

### Verification
```bash
source .env.test

curl -i -X POST http://localhost:3000/api/game/end \
  -H “Authorization: Bearer $E2E_PLAYER_TOKEN” \
  -H “Content-Type: application/json” \
  -d '{“game_id”:”'”$GAME_ID”'”}'

curl -i http://localhost:3000/api/game/$GAME_ID \
  -H “Authorization: Bearer $E2E_PLAYER_TOKEN”

pnpm vitest tests/unit/stats tests/integration/stats-refresh.test.ts
pnpm playwright test tests/e2e/gameover-share.spec.ts
```

## Phase 7: Operational Hardening, Security Review, And Release
**Goal:** Make the system safe to run continuously with predictable rollback, monitoring, and deployment behavior.
**Dependencies:** Phases 1-6
**Estimated effort:** L (revised from M — this phase contains three independently M-sized workstreams)

> **Note on observability timing:** The structured logger and request ID propagation were scaffolded in Phase 1 and wired into route handlers/Edge Functions throughout Phases 2-6. This phase adds the remaining dashboards, alert thresholds, and golden-signal definitions — it does not introduce observability from scratch.

### Tasks
1. Add deployment and environment promotion workflow.
   - Add `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `vercel.json`, and `docs/runbooks/deploy.md`.
   - Add `docs/runbooks/ci-setup.md` listing every required GitHub secret (`SUPABASE_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.) and runner configuration (Docker-capable for `supabase start`). Add a CI pre-flight step that validates required secrets are set.
   - CI must run lint, typecheck, unit tests, integration tests against local Supabase, and Playwright smoke tests. Add **dependency scanning** (e.g., `pnpm audit`), **secret scanning**, and basic SAST as blocking CI checks.
   - **Deployment order:** additive/backward-compatible schema migrations first → verification against migrated staging → app deploy → destructive cleanup deferred to a later release. Encode this ordering in `deploy.yml`.
   - **Canary/staged rollout:** deploy to a Vercel preview deployment first, validate against staging Supabase. Monitor error rates, AI fallback rate, and round-completion rate for 15-30 minutes before promoting to production. Define quantitative rollback triggers: error rate > 1% for 5 minutes, AI fallback > 20%, round-backstop fire rate > baseline + 2σ.
   - **Server-side kill switches:** route handlers for `/api/game/create`, `/api/game/join`, and `/api/ai/*` must check the `FEATURE_MULTIPLAYER_ENABLED` and `FEATURE_AI_ENABLED` environment variables. When disabled, return a structured degradation response. This provides server-side admission control independent of UI changes — existing clients, bookmarked URLs, and direct API calls are all gated.
   - **Production promotion gate:** require the security checklist (Task 3) to be committed and signed-off before `deploy.yml` can target production. Use a GitHub Environment protection rule or a required artifact check.
   - **Post-deploy smoke test:** add a step in `deploy.yml` that hits `/api/health`, creates a solo game session, and confirms a word-list validation response. For Phase 5+ deployments, confirm the AI provider is reachable and the circuit breaker is closed.
   - Done when a tagged or approved main-branch change can promote from local to staging to production with the defined migration-first ordering, canary gate, and security prerequisite.
2. Finalize monitoring dashboards, alert thresholds, and golden signals.
   - Complete the observability wiring started in Phases 1-6.
   - Define golden signals and alert thresholds:
     - P95 latency budget for game route handlers: <500ms
     - Error rate per route: <1% 5xx
     - AI fallback rate: alert at >10% sustained
     - Manual review entry rate: alert at >20% of rounds
     - Round backstop fire rate: alert at elevated baseline
     - Rate-limit reject rate: dashboard-visible
     - Scheduled job heartbeat: alert when any `job_health` entry is stale beyond 2× its cron cadence
     - AI budget consumption: alert at 80% and 95% of `AI_MONTHLY_BUDGET_USD`
   - **Log redaction contract:** explicitly forbid raw `Authorization` headers, cookies, service-role keys, full request bodies, and raw AI prompts/responses in logs. Define structured fields and redaction rules for player IDs and IPs. Add automated lint rules that fail on sensitive fields in log statements.
   - **Log retention policy:** 30 days for debug logs, 90 days for error/security events. Confirm no player-identifiable data (especially for child users) appears in logs — scrub if so. Verify compliance with applicable data protection requirements per the ADR from Phase 1.
   - Done when operators can tell whether the system is healthy without reproducing issues manually, every alert has a threshold and links to a runbook, and the log redaction contract passes automated verification.
3. Perform a final security and privacy review against the implemented system.
   - Verify that no client bundle contains provider keys or the Supabase service role key.
   - Re-test RLS, auth boundaries, sanitized prompt inputs, and children’s-data handling per the Phase 1 compliance ADR.
   - **HTTP security headers:** add to `next.config.ts` — `Content-Security-Policy` (allow Google Fonts CDN, block inline scripts except with nonces), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. Verify headers in the security checklist.
   - **Credential rotation procedures:** document in `docs/runbooks/security-checklist.md` — who holds each key, rotation steps per provider, downstream update steps, and verification without downtime. For AI providers, set spend limits and anomaly alerts in each provider’s dashboard.
   - Add `docs/runbooks/security-checklist.md`.
   - Done when staging passes a checklist review and all critical findings are fixed or explicitly waived. This sign-off is the prerequisite for the production promotion gate in Task 1.
4. Load and performance testing.
   - Add a k6 or Artillery script simulating N concurrent players submitting answers simultaneously.
   - Measure P95 round-trip time, error rate, Realtime fan-out latency, and database connection utilization.
   - Define passing thresholds: P95 < 2s end-to-end, error rate < 1%, no connection pool exhaustion at 50 concurrent game sessions.
   - Done when the load test passes and results are documented in `docs/runbooks/capacity.md`.

### Risks
- Scheduled jobs often fail silently in serverless systems: the `job_health` table and heartbeat alerts from Phase 2 provide detection. Phase 7 adds the alert thresholds and runbook links.
- Late-stage migration changes can invalidate seeded test data: freeze the schema before production cutover and rehearse rollback.
- **Phase 7 is the largest phase by work volume despite being labeled L.** Allocate explicit calendar time for the security review (minimum 2 days) — it must not be compressed under delivery pressure.

### Verification
```bash
pnpm lint
pnpm typecheck
pnpm vitest --run
pnpm playwright test
terraform -chdir=infra/terraform plan
source .env.test
curl -i http://localhost:3000/api/health
curl -i http://localhost:3000/api/game/$GAME_ID -H "Authorization: Bearer $E2E_PLAYER_TOKEN"
```

## 4. Integration Points
- Identity contract:
  - `player.id` must support a local provisional ID in offline solo mode and a Supabase-auth UUID online.
  - If this ships incomplete, solo recovery and multiplayer profile ownership will diverge.
- API contract:
  - Every client-facing route in `app/api/**` must return `{ ok: true, data }` or `{ ok: false, error }` from `lib/types/api.ts`.
  - If this ships incomplete, frontend error handling fragments immediately.
- Game authority contract:
  - Only route handlers and approved RPCs mutate authoritative game state.
  - If this ships incomplete, scoring, host transfer, and timer expiry will race or become tamperable.
- AI contract:
  - `lib/ai/schema.ts` defines the only accepted validation/hint/generation payload shapes.
  - If this ships incomplete, malformed model output can corrupt round results.
- Stats contract:
  - `game_players.rank` and `stats_refresh_queue` are the handoff between game finalization and profile statistics.
  - If this ships incomplete, wins, strongest category, and leaderboards will be wrong even when gameplay is correct.
- Operational contract:
  - `room-cleanup`, `round-backstop`, `presence-scan`, `stats-refresh`, and `retention-cleanup` are required parts of the product, not background nice-to-haves.
  - If any ship incomplete, rooms leak, rounds stick open, hosts do not transfer, or retained data drifts from policy.

## 5. Testing Strategy
- Unit tests first:
  - `lib/game/normalization.ts`, `lib/game/scoring.ts`, `lib/game/stateMachine.ts`, `lib/game/difficulty.ts`, `lib/ai/circuitBreaker.ts`, `lib/rateLimit.ts`, `lib/storage/*`.
  - Add these during Phases 1-3 so the pure rules are fixed before API work expands the blast radius.
- Integration tests second:
  - Route handlers in `app/api/**`
  - Supabase RPCs, RLS behavior, migrations, scheduled job handlers
  - AI fallback flows with mocked Claude/OpenAI failures
  - Add these during Phases 2-6 using local Supabase and seeded auth tokens (from `tests/scripts/seed-e2e-tokens.sh`).
  - Add RLS smoke tests in `supabase/tests/rls.test.sql` (Phase 2) covering write-block policies and heartbeat RPC.
- End-to-end tests last, but before release:
  - Offline solo new game and recovery (Phase 3)
  - Multiplayer create/join/start/done/results/end
  - Manual review on provider timeout
  - Host transfer after disconnect
  - Budget-cap fallback to word-list mode
  - Add smoke E2E in Phase 3 (solo-offline) and Phase 4 (multiplayer), full E2E coverage by Phase 7.
- AI validation accuracy evaluation:
  - `tests/eval/ai-validation-accuracy.test.ts` — run a fixed Hebrew answer set through the validation endpoint. Phase 5 go/no-go gate: ≥90% agreement with human-labeled ground truth.
- Load testing (Phase 7):
  - k6 or Artillery script simulating concurrent players. Passing thresholds: P95 < 2s, error rate < 1%, no connection pool exhaustion at 50 concurrent sessions.
- Recommended command surface:
```bash
pnpm vitest
pnpm vitest tests/integration --run
pnpm playwright test
supabase db test  # requires supabase/tests/*.test.sql files (created in Phase 2)
```

## 6. Rollback Plan

### General principles
- **Feature flags for rollback:** `FEATURE_MULTIPLAYER_ENABLED` and `FEATURE_AI_ENABLED` are Vercel environment variables checked by route handlers via `lib/middleware/featureGates.ts` at request time. Toggling them provides immediate server-side gating without redeployment. The middleware was scaffolded in Phase 1 and is available from Phase 4 onward.
- **Schema backward compatibility:** every migration in Phases 2+ must be backward-compatible with the previous phase's code: new columns must have defaults or be nullable, no columns read by prior code may be dropped without a two-phase expand/contract migration. This allows rolling back app code while leaving the database schema in place.
- **Pre-deploy backup:** before every production migration, take a Supabase PITR restore point (or confirm backup cadence and retention). Document restore ownership, target RPO (≤1 hour of game data), and target RTO (≤2 hours).
- **Down migrations:** every forward migration ships with a tested reverse migration (Phase 2 deliverable). Test round-trips in staging before production.

### Points of no return
- **⚠️ POINT OF NO RETURN — Phase 2:** first production migration apply + first real user data (anonymous auth sessions, player profiles). After this point, rolling back the database requires PITR restore, not just code revert.
- **⚠️ POINT OF NO RETURN — Phase 6:** first `player_stats` overwrite by the async refresh pipeline. Previous values are gone unless a backup exists.

### Rollback triggers
| Phase | Trigger | Action |
|-------|---------|--------|
| 2 | Migration fails mid-apply | Halt. Run down migrations. Restore from PITR if data was written. |
| 4 | Error rate > 5% for 3 min on game routes | Set `FEATURE_MULTIPLAYER_ENABLED=false`. Investigate. |
| 4 | Round backstop heartbeat missing for > 5 min | Disable multiplayer. Check Edge Function deployment. |
| 5 | AI fallback rate > 50% sustained | Set `FEATURE_AI_ENABLED=false`. Check provider status. |
| 5 | Budget > 95% mid-month | Automatic degradation to word-list mode (built into budget.ts). |
| 6 | Stats refresh queue depth growing unbounded | Pause stats-refresh schedule. Investigate drain logic. |
| 7 | Post-deploy smoke test fails | Immediately roll back Vercel to previous deployment. |

### Per-phase rollback procedures

- **Phase 1 rollback:**
  - Revert scaffold files only; keep static HTML demos and docs untouched.
  - If bootstrap is unstable, return the repo to a docs-only state and keep ADR decisions.

- **Phase 2 rollback:**
  - **Pre-apply:** revert Terraform changes (no data at risk).
  - **Post-apply (no user data yet):** run the pre-tested down migrations in reverse dependency order. Disable cron schedules first (`SELECT cron.unschedule(jobid) FROM cron.job;`), then drop RPCs, policies, indexes, tables.
  - **Post-apply (user data exists):** do NOT run destructive down migrations against live data. Instead: (1) set `FEATURE_MULTIPLAYER_ENABLED=false` to stop new writes, (2) take note of the PITR target timestamp, (3) restore from PITR backup to the pre-migration state, (4) verify schema and data integrity, (5) redeploy the previous app version. Keep the Supabase project and Terraform state intact — only the database content is restored. Writes during the restore window are lost; accepted as within RPO ≤1h.
  - **Post-apply Terraform (Supabase project exists):** project destruction is not viable. Instead, disable scheduled functions, disconnect the Vercel project, and revert Vercel env vars. Keep Terraform state in a remote backend so concurrent operators don't diverge.

- **Phase 3 rollback:**
  - Set `FEATURE_MULTIPLAYER_ENABLED=false` in Vercel env vars to restrict to home/profile-only.
  - **LocalStorage handling:** the rolled-back code must have the schema version validator present (shipped in Phase 3 itself). If rolling back to pre-Phase-3 code, include a one-time LocalStorage clear for `eretz-eir:current-game` with a user-visible message (“saved game is incompatible, starting fresh”).
  - Do not change local storage keys in-place without a migration path.

- **Phase 4 rollback:**
  - Set `FEATURE_MULTIPLAYER_ENABLED=false` — this gates `/api/game/create`, `/api/game/join`, and lobby routes at the server level, not just UI.
  - **Drain active games:** before reverting route handlers, block new room creation, disable multiplayer cron schedules, then either drain active games to completion on the current build or cancel them with a scripted state transition (`UPDATE game_sessions SET status = 'finished' WHERE status IN ('waiting', 'playing', 'reviewing')`).
  - Revert only the affected route handlers and realtime subscriptions; do not roll back unrelated profile or solo features.
  - Schema must be backward-compatible (expand/contract) — do not roll back Phase 4 schema if Phase 3 code is still running.

- **Phase 5 rollback:**
  - Set `FEATURE_AI_ENABLED=false` — this gates `/api/ai/*` routes and forces `done/route.ts` and `timer-expired/route.ts` to use the word-list fallback validator.
  - Keep manual review and solo validation enabled so games can still finish.

- **Phase 6 rollback:**
  - **Queue state:** before stopping `stats-refresh` schedule, check queue depth. If > 0, either drain to completion (preferred) or truncate with a documented note of affected player_ids for manual recomputation after re-deploy.
  - Stop the `stats-refresh` schedule, revert leaderboard/profile surfaces to a “temporarily unavailable” state, and keep raw game-over scoring intact.
  - **If stats data is corrupted:** run the deterministic rebuild-from-raw-game-results job (`rebuildPlayerStats.ts`) to recompute `game_players.rank` and `player_stats` from source data.
  - Do not run trigger-based materialized view refresh as an emergency patch.

- **Phase 7 rollback:**
  - Roll back the Vercel deployment to the last green release. “Green” = all Phase 7 verification commands pass in CI + security checklist signed off + no P1 incidents open. Tag green releases in Vercel for easy identification.
  - Re-apply the matching environment variables and disable any newly introduced schedules or alerts.
  - Re-run the Phase 4-6 smoke tests against the rolled-back release before reopening multiplayer traffic.
