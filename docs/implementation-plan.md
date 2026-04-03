# Eretz-Eir Implementation Plan

> **Synthesized from multi-agent design-to-plan review (2026-04-03)**
> - Base plan: **codex** (9.0/10) — 7 phases, 430 lines
> - Cross-reviewed by: gemini (scored codex 9.0/10), codex (scored gemini 5.0/10)
> - Claude agent: timed out (2/3 plans generated)
> - Synthesis fixes applied: Phase 2/3 parallelization, LocalStorage schema versioning, timer backstop UI transition

## 1. Overview
Build the product in seven phases that keep the system usable after every checkpoint: first freeze the missing contracts and scaffold the Next.js/Tailwind/Zustand codebase around the existing design artifacts, then provision Supabase/Vercel infrastructure and the database schema, then ship a fully working solo game loop backed by LocalStorage and deterministic word-list fallbacks, then add server-authoritative multiplayer and realtime state sync, then layer in AI validation/hints/competitors with circuit breaking and manual review, and finally harden the system with statistics pipelines, scheduled maintenance, monitoring, and release gates. Key constraints from the design are non-negotiable: Hebrew-only RTL UI, server-authoritative scoring and validation, all AI calls proxied through API routes, explicit Supabase-backed rate limiting, and operational tasks implemented as scheduled jobs rather than comments.

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
  - `vercel CLI`
  - `terraform >= 1.8`
  - `docker` for `supabase start`
- Required accounts/access:
  - Supabase project admin access
  - Vercel project admin access
  - Anthropic API key
  - OpenAI API key
- Bootstrap commands:
```bash
brew install node pnpm supabase/tap/supabase vercel terraform
pnpm install
supabase login
vercel login
```
- Repository bootstrap targets:
  - `package.json`
  - `app/`
  - `components/`
  - `lib/`
  - `stores/`
  - `data/`
  - `supabase/`
  - `infra/terraform/`
  - `tests/`
- Environment variables to provision in `.env.local`, Vercel, and CI:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ANTHROPIC_API_KEY`
  - `OPENAI_API_KEY`
  - `AI_MONTHLY_BUDGET_USD`
  - `APP_BASE_URL`

## 3. Phases

## Phase 1: Contract Freeze And Repository Scaffold
**Goal:** Turn the design into an implementable repository with agreed contracts, toolchain, and directory layout.
**Dependencies:** None
**Estimated effort:** S

### Tasks
1. Freeze the unresolved architecture decisions.
   - Create `docs/adr/0001-core-contracts.md` and record the six prerequisite decisions above, plus the chosen room-code length and the offline identity model.
   - Update `DESIGN.md` only where the ADR changes the design contract.
   - Done when every unresolved design-review item has an owner, an approved resolution, or a documented deferral.
2. Scaffold the Next.js application without overwriting the existing static demos.
   - Add `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.js`, `tailwind.config.ts`, `eslint.config.js`, `prettier.config.mjs`, `middleware.ts`.
   - Create empty folders and initial files for `app/`, `components/`, `lib/`, `stores/`, `data/`, `tests/`, `supabase/`, `infra/terraform/`.
   - Preserve `index.html`, `home-demo.html`, and `profile-demo.html` as design references until React equivalents exist.
   - Done when `pnpm dev`, `pnpm lint`, and `pnpm test` run successfully on a clean clone.
3. Establish the shared TypeScript contracts and file boundaries.
   - Add `lib/types/game.ts`, `lib/types/api.ts`, `lib/types/ai.ts`, `lib/constants/categories.ts`, `lib/constants/letters.ts`.
   - Define the API envelope types matching the design: `ApiSuccess<T>`, `ApiError`, `GameSession`, `Round`, `Answer`, `PlayerProfile`.
   - Add function stubs matching the design signatures:
     - `lib/ai/provider.ts::async function callAI(prompt: string, systemPrompt: string): Promise<string>`
     - `lib/game/scoring.ts::function scoreAnswer(answer: ValidatedAnswer, allAnswers: ValidatedAnswer[]): AnswerScore`
     - `lib/game/normalization.ts::function fuzzyMatch(a: string, b: string): boolean`
     - `lib/game/difficulty.ts::function adjustDifficulty(state: DifficultyState, competitors: AICompetitor[]): AICompetitor[]`
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
**Goal:** Provision Supabase/Vercel infrastructure, ship the base schema, and make auth, migrations, and scheduled jobs reproducible.
**Dependencies:** Phase 1
**Estimated effort:** M

### Tasks
1. Provision cloud resources and environment wiring as code.
   - Add `infra/terraform/main.tf`, `infra/terraform/supabase.tf`, `infra/terraform/vercel.tf`, `infra/terraform/variables.tf`, `infra/terraform/outputs.tf`.
   - Provision:
     - Supabase project
     - Vercel project and environment variables
     - Scheduled invocations for Supabase Edge Functions
   - If Terraform coverage is incomplete for a target, add a documented bootstrap script at `infra/scripts/bootstrap.sh` and make the gap explicit in the ADR.
   - Done when staging can be recreated from the repo without manual dashboard-only setup.
2. Create the initial Postgres schema and safe auth/RLS model.
   - Add `supabase/migrations/0001_core_tables.sql` for `players`, `player_stats`, `game_sessions`, `game_players`, `rounds`, `answers`, `rooms`, `rate_limits`, `stats_refresh_queue`.
   - Add `supabase/migrations/0002_indexes.sql` for hot-path indexes, including active-round and active-room indexes.
   - Add `supabase/migrations/0003_policies.sql` that:
     - permits player profile self-management
     - blocks direct `answers` writes from clients
     - blocks direct game-state mutations from clients
     - exposes read scopes only to participants
   - Add `supabase/migrations/0004_rpc.sql` for `increment_or_reset(...)`, `heartbeat(game_id uuid)`, and any helper RPCs needed for rate limiting or safe presence updates.
   - Done when `supabase db reset` produces a working schema and the service role is only needed inside route handlers or Edge Functions.
3. Implement the operational job surface now, not later.
   - Add `supabase/functions/room-cleanup/index.ts`, `supabase/functions/round-backstop/index.ts`, `supabase/functions/presence-scan/index.ts`, `supabase/functions/stats-refresh/index.ts`, `supabase/functions/retention-cleanup/index.ts`.
   - Schedule them explicitly:
     - every 15 minutes: room cleanup
     - every 30 seconds: round backstop
     - every 30 seconds: presence scan / host transfer
     - every minute: stats refresh queue drain
     - monthly: retention cleanup
   - Done when each function has an invocation schedule, failure logging, and idempotent behavior.
4. Wire Supabase clients and health checks into the app.
   - Add `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/health.ts`.
   - Add a load-time health probe used by the UI to disable multiplayer when Supabase is unavailable.
   - Done when local and staging environments can sign in anonymously online, and the app can distinguish `online-multiplayer-ready` from `solo-only` mode.

### Risks
- Over-permissive RLS can silently undermine server authority: enforce writes through API/service-role paths only.
- Terraform provider gaps can stall provisioning: keep a scripted fallback and track every manual step as debt.
- Scheduled jobs can race with API transitions: make every function idempotent and predicate all writes on current row state.

### Verification
```bash
terraform -chdir=infra/terraform init
terraform -chdir=infra/terraform plan
supabase start
supabase db reset
supabase functions serve --no-verify-jwt
curl -i http://127.0.0.1:54321/rest/v1/players -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_TEST_PLAYER_TOKEN"
```

## Phase 3: Profile, Layout, And Solo-Mode Foundation
**Goal:** Ship a usable RTL application shell, profile persistence, and local-only solo state recovery without multiplayer or AI dependencies.
**Dependencies:** Phase 1 (Phase 2 infra tasks can run in parallel with Phase 3 UI tasks — see note below)
**Estimated effort:** M

> **Parallelization note:** Phase 3 tasks 1 and 2 (UI shell, profile storage) have no runtime dependency on Phase 2 infrastructure — they only need the types and contracts from Phase 1. Start UI scaffolding and Phase 2 provisioning concurrently. Phase 3 tasks 3 and 4 (game store, solo gameplay) can also proceed in parallel with Phase 2, since they use LocalStorage only. The only Phase 2 dependency is the Supabase client wiring needed for online profile sync, which can be integrated once Phase 2 completes.

### Tasks
1. Build the RTL shell and shared UI primitives.
   - Implement `app/layout.tsx`, `app/page.tsx`, `app/setup/page.tsx`, `components/ui/{Button,Input,Card,Timer,Modal,Avatar,Badge,Spinner}.tsx`.
   - Apply `lang=”he”` and `dir=”rtl”` at the root, configure Heebo/Rubik font loading, and encode the accessibility requirements into the base components.
   - Done when the home/setup flows match the static demos and pass keyboard-only navigation checks.
2. Implement profile storage with offline-first identity.
   - Add `stores/playerStore.ts`, `lib/storage/localPlayer.ts`, `app/api/player/route.ts`, `components/profile/{ProfileForm,StatsDisplay,GameHistory}.tsx`.
   - Use a locally generated UUID when offline, then link or replace it with the Supabase-auth UUID when the client obtains an anonymous session online.
   - Done when a first-time user can create a profile offline, reload the app, and keep the same local profile.
3. Implement the solo game state store and crash recovery contract.
   - Add `stores/gameStore.ts`, `lib/storage/localGame.ts`, `lib/game/session.ts`, `lib/game/letters.ts`, `lib/game/categoryPool.ts`.
   - Persist `eretz-eir:player`, `eretz-eir:settings`, `eretz-eir:games`, and `eretz-eir:current-game` exactly as the design requires.
   - **LocalStorage schema versioning:** Include a `schemaVersion: number` field in the `eretz-eir:current-game` payload. On hydration, validate the stored state against a Zod schema matching the current version. If the stored version is older or validation fails, clear the stale state gracefully (show “saved game is incompatible” rather than crashing). This prevents application errors when the game state model evolves between deployments.
   - Add the “continue game?” recovery dialog and make sure interrupted rounds restore correctly from local state.
   - Done when solo state survives refreshes and browser restarts without network access.
4. Ship deterministic solo gameplay before AI.
   - Add `data/word-lists.json` and a deterministic local validator/generator path in `lib/game/fallbackWords.ts`.
   - Implement `app/game/[id]/page.tsx`, `components/game/{LetterDisplay,CategoryCard,CategoryGrid,HelpButton,DoneButton,PlayerBar,PlayerChip,CompetitorProgress}.tsx`.
   - Use word-list mode for local-only solo rounds so the end-to-end solo loop works before AI or Supabase is involved.
   - Done when a full solo game can be played, scored, ended, and shown in history using only LocalStorage.

### Risks
- Offline identity linking can duplicate profiles when the client later comes online: store a local-to-remote linkage record and migrate only once.
- Accessibility regressions will be expensive to retrofit: encode focus, labels, live regions, and reduced-motion behavior in base components now.

### Verification
```bash
pnpm dev
pnpm vitest tests/unit/storage tests/unit/game
pnpm playwright test tests/e2e/solo-offline.spec.ts
```

## Phase 4: Server-Authoritative Game Engine And Multiplayer Realtime
**Goal:** Move game-state authority to the server for multiplayer, including lobby flows, legal state transitions, timer backstops, and reconnection handling.
**Dependencies:** Phases 1-3
**Estimated effort:** L

### Tasks
1. Implement the core server game engine and transaction boundaries.
   - Add `lib/game/stateMachine.ts`, `lib/game/submitRound.ts`, `lib/game/uniqueness.ts`, `lib/game/ranking.ts`, `lib/rateLimit.ts`.
   - Centralize legal transitions for `waiting -> playing -> reviewing|manual_review -> completed -> finished`.
   - Ensure uniqueness calculation, `submitted_at`, speed bonus, and per-answer scores are computed in one server transaction after answer collection closes.
   - Done when game actions are rejected on illegal transitions and no scoring field depends on client timestamps.
2. Implement authenticated route handlers for all game actions.
   - Add `app/api/game/{create,join,start,done,next-round,timer-expired,end,review}/route.ts`, `app/api/game/[id]/route.ts`, and `app/api/game/heartbeat/route.ts` if RPC-only heartbeat is not enough.
   - Route handlers must authenticate the caller, enforce IP and per-session rate limits via `rate_limits`, and use the service role only where required.
   - Done when every route returns the standard `{ ok, data|error }` envelope and only the host can call host-only actions.
3. Add lobby, join, and realtime synchronization.
   - Implement `app/lobby/[code]/page.tsx`, `app/join/[code]/page.tsx`, `components/lobby/{RoomCode,ShareLink,PlayerList}.tsx`.
   - Add `lib/realtime/gameChannel.ts` to subscribe to `game:{game_id}` and normalize `player_joined`, `player_left`, `round_start`, `player_done`, `round_end`, `answers_revealed`, `host_changed`, `game_over`.
   - Done when two browsers can create, join, and observe the same lobby and round state without direct client table writes.
4. Implement disconnect handling and host transfer.
   - Use the heartbeat RPC/route plus `presence-scan` to mark disconnected players, auto-transfer host after 60 seconds, and score abandoned players correctly after 5 minutes.
   - Add announcement wiring to the game store and `aria-live` regions.
   - Done when reconnection restores state correctly and host transfer occurs exactly once.

### Risks
- Mixed client/server writes can create race conditions: enforce a single server mutation path for all authoritative state.
- Realtime can mask missing persistence guarantees: treat channel events as notifications only and always rehydrate state from Postgres after critical actions.
- Timer expiry can double-fire from clients and cron: make `timer-expired` idempotent and conditional on `rounds.status = 'playing'`.
- Timer backstop UI hang: if a client's local timer reaches zero but the server hasn't transitioned the round yet (up to 29s delay from the 30s cron), the UI should optimistically transition to a "waiting for results..." state rather than hanging on a dead timer. The client calls `POST /api/game/timer-expired` and shows a loading state until the server confirms the transition.

### Verification
```bash
curl -i -X POST http://localhost:3000/api/game/create \
  -H "Authorization: Bearer $E2E_PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"multiplayer","category_mode":"fixed","categories":["ארץ","עיר","חי","צומח","ילד","ילדה","מקצוע","זמר/ת"],"timer_seconds":180,"helps_per_round":2}'

curl -i -X POST http://localhost:3000/api/game/join \
  -H "Authorization: Bearer $E2E_PLAYER2_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"4829"}'

curl -i -X POST http://localhost:3000/api/game/start \
  -H "Authorization: Bearer $E2E_PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"game_id":"$GAME_ID"}'

pnpm vitest tests/integration/api/game-routes.test.ts
pnpm playwright test tests/e2e/multiplayer-room.spec.ts
```

## Phase 5: AI Layer, Manual Review, And Budget Controls
**Goal:** Replace deterministic fallbacks with provider-backed AI flows while keeping the system safe under latency, outage, and budget pressure.
**Dependencies:** Phases 1-4
**Estimated effort:** L

### Tasks
1. Implement the provider abstraction and circuit breaker exactly once.
   - Implement `lib/ai/provider.ts`, `lib/ai/claude.ts`, `lib/ai/openai.ts`, `lib/ai/circuitBreaker.ts`.
   - Persist provider failure counts and `open_until` in `rate_limits` under the `circuit:claude` key.
   - Enforce the designed timeout and retry behavior before fallback.
   - Done when Claude failures route traffic to OpenAI without adding repeated timeout latency.
2. Implement structured AI validation, hinting, and competitor generation.
   - Implement `lib/ai/validate.ts`, `lib/ai/generate.ts`, `lib/ai/prompts.ts`, `lib/ai/schema.ts`.
   - Implement `app/api/ai/hint/route.ts` for `mode: "hint" | "fill"` and wire `sanitizeAnswer(text: string): string`.
   - Route all round-end validation through server-internal functions invoked by `done/route.ts` and `timer-expired/route.ts`.
   - Done when validation, hints, and competitor answers all return schema-validated JSON and reject malformed model output.
3. Implement manual review and failure degradation.
   - Add `components/results/{ResultsTable,AnswerCell,SpeedBonusIcon,HelpUsedIcon}.tsx` and host-only review controls in `app/game/[id]/results/page.tsx`.
   - Add server logic that moves rounds into `manual_review`, stores host decisions, auto-accepts timed-out review items after two minutes, and uses optimistic letter-only acceptance in solo mode if both providers are down.
   - Done when total provider outage still lets a round finish without deadlocking the game.
4. Implement cost and concurrency controls.
   - Extend `rate_limits` usage for:
     - per-IP AI requests
     - per-game AI call counts
     - global concurrent AI calls
     - per-round help limits
     - monthly budget enforcement
   - Add `lib/ai/budget.ts` and dashboard-facing metrics/logging in `lib/observability/ai.ts`.
   - Done when the app cleanly switches to word-list mode after budget exhaustion and emits logs for every degraded path.

### Risks
- Output-schema drift from the models can corrupt scoring: reject any response that fails Zod validation and fall back immediately.
- Manual review can become a dead-end state: enforce the two-minute timeout on the server, not the client.
- AI features can hide rate-limit bugs until production: test with concurrent players and forced provider failures locally.

### Verification
```bash
curl -i -X POST http://localhost:3000/api/ai/hint \
  -H "Authorization: Bearer $E2E_PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"round_id":"'$ROUND_ID'","category":"חי","letter":"נ","mode":"hint"}'

curl -i -X POST http://localhost:3000/api/game/done \
  -H "Authorization: Bearer $E2E_PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"round_id":"'$ROUND_ID'","answers":[{"category":"ארץ","text":"מצרים"},{"category":"עיר","text":"מוסקבה"}]}'

pnpm vitest tests/unit/ai tests/integration/ai-fallback.test.ts
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
   - Done when every finished game has stable ranks and player stat recomputation is deterministic.
2. Replace trigger-side materialized view refresh with an async refresh pipeline.
   - Add `supabase/migrations/0005_stats_pipeline.sql` to:
     - enqueue player IDs on relevant game finalization events
     - expose a `refresh_player_stats(player_ids uuid[])` function
   - Make `supabase/functions/stats-refresh/index.ts` drain the queue, recompute `player_stats`, and then run `REFRESH MATERIALIZED VIEW CONCURRENTLY player_category_stats`.
   - Done when stats refreshes succeed outside the write transaction and can be safely retried.
3. Ship profile, history, leaderboard, and game-over surfaces.
   - Implement `app/gameover/[id]/page.tsx`, `components/gameover/{Leaderboard,StatHighlight,ShareButton}.tsx`, `components/profile/GameHistory.tsx`.
   - Clarify in the UI that solo history is local-only in v1 while multiplayer profile stats are cloud-backed.
   - Done when the player can finish a game, see rankings and highlights, and revisit history later.
4. Implement share generation and exported result artifacts.
   - Add `lib/share/renderResultImage.ts` and dynamic imports for share-only code paths.
   - Ensure WhatsApp-friendly output for the final results image or link.
   - Done when the share action works without inflating the initial game bundle.

### Risks
- Stats divergence between local solo and cloud multiplayer can confuse users: label each stats source explicitly.
- Async refresh lag can make profiles briefly stale: show “last updated” metadata and accept up-to-one-job-cycle delay.

### Verification
```bash
curl -i -X POST http://localhost:3000/api/game/end \
  -H "Authorization: Bearer $E2E_PLAYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"game_id":"'$GAME_ID'"}'

curl -i http://localhost:3000/api/game/$GAME_ID \
  -H "Authorization: Bearer $E2E_PLAYER_TOKEN"

pnpm vitest tests/unit/stats tests/integration/stats-refresh.test.ts
pnpm playwright test tests/e2e/gameover-share.spec.ts
```

## Phase 7: Operational Hardening, Security Review, And Release
**Goal:** Make the system safe to run continuously with predictable rollback, monitoring, and deployment behavior.
**Dependencies:** Phases 1-6
**Estimated effort:** M

### Tasks
1. Add deployment and environment promotion workflow.
   - Add `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `vercel.json`, and `docs/runbooks/deploy.md`.
   - CI must run lint, typecheck, unit tests, integration tests against local Supabase, and Playwright smoke tests.
   - Done when a tagged or approved main-branch change can promote from local to staging to production with the same migration set.
2. Add monitoring, structured logs, and alertable failure signals.
   - Implement `lib/observability/logger.ts`, `lib/observability/requestId.ts`, and wire logging into route handlers, Edge Functions, and AI provider calls.
   - Emit metrics/log events for:
     - AI fallback usage
     - manual review entry rate
     - room cleanup failures
     - overdue round backstop interventions
     - rate-limit rejects
   - Done when operators can tell whether the system is healthy without reproducing issues manually.
3. Perform a final security and privacy review against the implemented system.
   - Verify that no client bundle contains provider keys or the Supabase service role key.
   - Re-test RLS, auth boundaries, sanitized prompt inputs, and children’s-data handling.
   - Add `docs/runbooks/security-checklist.md`.
   - Done when staging passes a checklist review and all critical findings are fixed or explicitly waived.

### Risks
- Scheduled jobs often fail silently in serverless systems: every job needs explicit logging, retries, and a dashboard-visible heartbeat.
- Late-stage migration changes can invalidate seeded test data: freeze the schema before production cutover and rehearse rollback.

### Verification
```bash
pnpm lint
pnpm typecheck
pnpm vitest --run
pnpm playwright test
terraform -chdir=infra/terraform plan
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
  - Add these during Phases 2-6 using local Supabase and seeded auth tokens.
- End-to-end tests last, but before release:
  - Offline solo new game and recovery
  - Multiplayer create/join/start/done/results/end
  - Manual review on provider timeout
  - Host transfer after disconnect
  - Budget-cap fallback to word-list mode
  - Add smoke E2E in Phase 4 and full E2E coverage by Phase 7.
- Recommended command surface:
```bash
pnpm vitest
pnpm vitest tests/integration --run
pnpm playwright test
supabase db test
```

## 6. Rollback Plan
- Phase 1 rollback:
  - Revert scaffold files only; keep static HTML demos and docs untouched.
  - If bootstrap is unstable, return the repo to a docs-only state and keep ADR decisions.
- Phase 2 rollback:
  - Revert Terraform changes before apply if possible.
  - For applied database changes, create explicit down migrations for new tables, policies, RPCs, and schedules; disable scheduled functions before dropping dependent schema.
  - Keep production on the previous schema until `supabase db reset` and staging smoke tests pass again.
- Phase 3 rollback:
  - Feature-flag the Next.js app to home/profile-only and preserve LocalStorage compatibility keys.
  - Do not change local storage keys in-place without a migration path.
- Phase 4 rollback:
  - Disable multiplayer entry points in the UI and keep solo mode available.
  - Revert only the affected route handlers and realtime subscriptions; do not roll back unrelated profile or solo features.
- Phase 5 rollback:
  - Set the AI feature flag to word-list-only mode.
  - Keep manual review and solo validation enabled so games can still finish.
- Phase 6 rollback:
  - Stop the `stats-refresh` schedule, revert leaderboard/profile surfaces to a “temporarily unavailable” state, and keep raw game-over scoring intact.
  - Do not run trigger-based materialized view refresh as an emergency patch.
- Phase 7 rollback:
  - Roll back the Vercel deployment to the last green release, re-apply the matching environment variables, and disable any newly introduced schedules or alerts that page noisily.
  - Re-run the Phase 4-6 smoke tests against the rolled-back release before reopening multiplayer traffic.
