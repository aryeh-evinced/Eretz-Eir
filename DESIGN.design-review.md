# Design Review — DESIGN.md

**File:** `DESIGN.md`
**Reviewer:** stark-review-design (standard mode)
**Agents:** Claude, Codex (2 × 11 domains per round)
**Rounds:** 2 fix + 1 final review
**Date:** 2026-04-03

---

**Issues found:** 77 (65 fixed, 12 unresolved) | **Noise:** 224 | **Ignored (low):** 84
**Signal-to-noise:** 25%

---

## Fixed — Round 1 (45 issues)

| # | Agent(s) | Domain | Section | Title |
|---|----------|--------|---------|-------|
| 1 | claude×2, codex×3 | security, completeness, general | Storage / Security | Authentication model completely missing — RLS depends on `auth.uid()` but auth never defined |
| 2 | claude, codex×2 | api-design, completeness | Frontend Component Tree | API request/response contracts not specified for any endpoint |
| 3 | claude | data-modeling | Data Models | AI competitors violate `game_players` FK — `player_id` must reference `players` table |
| 4 | claude×4 | scalability, resilience, security, general | Rate Limiting | In-memory rate limiter non-functional in serverless (Vercel) deployment |
| 5 | claude×2, codex | security, general | Speed Bonus Tracking | Client-side `submitted_at` timestamps are tameable — speed bonus unfair |
| 6 | claude, codex | accessibility | Results | Validation results conveyed by color alone — no text/icon alternative |
| 7 | claude, codex | accessibility | Realtime Events | No ARIA live regions for real-time game events |
| 8 | claude, codex | accessibility | Components | Keyboard navigation and focus management unspecified |
| 9 | claude, codex | completeness, general | Multiplayer | Host disconnection and ownership transfer undefined |
| 10 | claude×2, codex | security, scalability | Room Access | 4-digit room code brute-forceable without join rate limiting |
| 11 | claude | data-modeling | Data Models | `answers.player_id` has no FK constraint |
| 12 | claude×2, codex | data-modeling, general | Player Profile | `player_stats` has no update ownership or trigger strategy |
| 13 | claude×2 | data-modeling, consistency | Player Profile | `avg_score_per_round` in JSON model but absent from SQL |
| 14 | claude×3, codex | data-modeling, scalability, completeness | Statistics | Materialized view has no refresh strategy |
| 15 | claude | data-modeling | Data Models | `expectedScore` referenced in adaptive difficulty but never defined |
| 16 | claude, codex×2 | completeness, api-design | AI Integration | Manual review fallback referenced but never designed |
| 17 | claude×2 | completeness, resilience | AI Integration | Total AI failure path (both providers down) unspecified |
| 18 | codex | resilience | Multiplayer | Serverless has no durable executor for round timers |
| 19 | claude, codex | consistency | Answer Validation | Validation batching described inconsistently between sections |
| 20 | codex | consistency | Speed Bonus | `submitted_at` used with two different meanings |
| 21 | codex | consistency | Fallback Strategy | Timeout/retry flow contradicts pending-review fallback |
| 22 | claude, codex | scalability | Data Models | No indexes defined beyond primary keys |
| 23 | claude, codex | resilience | Architecture | Supabase is SPOF for multiplayer with no degradation plan |
| 24 | claude | security | Security | No COPPA/GDPR-K mention for a children's product |
| 25 | claude | completeness | Game Flow | Random category mode never defined |
| 26 | claude | completeness | Game Flow | Solo crash recovery flow unspecified |
| 27 | claude | completeness | AI Integration | Pre-generated word lists fallback mentioned but never defined |
| 28 | claude | api-design | Architecture | No standard error response envelope |
| 29 | claude | security | Storage | Missing INSERT RLS policies |
| 30 | codex | data-modeling | Room | Room lifecycle/expiry not in data model |
| 31 | claude | resilience | Multiplayer | Heartbeat mechanism depends on the Realtime channel it monitors |
| 32 | claude | consistency | Scoring Engine | TIMESTAMPTZ used as numeric operand in TypeScript |
| 33 | codex | completeness | Storage | Data retention policy undefined |
| 34 | claude | api-design | Frontend | `/api/game/action` is underspecified catch-all |
| 35 | claude | data-modeling | Scoring Engine | `is_unique` requires cross-player write with no transaction boundary |
| 36 | codex | resilience | Fallback Strategy | AI failover can cascade — no circuit breaker |
| 37 | claude | general | Game Flow | Player age not in profile schema but referenced for AI competitor selection |
| 38 | claude, codex | accessibility | Components | Touch targets not specified for mobile-first design |
| 39 | claude, codex | accessibility | Performance | No `prefers-reduced-motion` consideration |
| 40 | codex | accessibility | Components | Form labeling and accessible error handling unspecified |
| 41 | codex | accessibility | Components | Image and icon accessibility strategy missing |
| 42 | claude | consistency | AI Integration | Auto-fill rate limit undefined |
| 43 | codex | data-modeling | Answers | Missing participant-level referential integrity |
| 44 | claude | completeness | Game Flow | Solo stats don't reach cloud — stats incomplete |
| 45 | claude | resilience | AI Integration | No timeout defined for Supabase database operations |

## Fixed — Round 2 (20 issues, 3 recurring from round 1)

| # | Agent(s) | Domain | Section | Title | Recurring? |
|---|----------|--------|---------|-------|------------|
| 46 | claude×4, codex×3 | api-design, security, consistency, general | API Contracts | "Internal server-only" AI routes are publicly accessible HTTP endpoints | No |
| 47 | claude×2, codex×2 | api-design, consistency | API Contracts / Speed Bonus | `submitted_at` in request body contradicts server-authoritative design | **Recurring** (partially fixed in R1 but reintroduced in API table) |
| 48 | claude×3, codex | data-modeling, completeness, consistency, general | Game Session / Game Flow | `used_categories` referenced but never added to schema | No |
| 49 | claude×3, codex | data-modeling, completeness, general, resilience | Player Stats | Stats trigger is a stub — only sends `pg_notify`, no actual recalculation | **Recurring** (trigger strategy added in R1 but implementation was hollow) |
| 50 | codex×2, claude | completeness, consistency, data-modeling | Multiplayer | Disconnect/host-transfer logic needs `last_seen`/`is_host` in game_players | No |
| 51 | codex | consistency | Realtime Events | `timer_tick` events conflict with client-side timer design | No |
| 52 | claude×2 | resilience, general | Fallback Strategy | Circuit breaker state lost between serverless invocations | No |
| 53 | claude | api-design | Timer Implementation | `timer_expired` endpoint missing from route tree | No |
| 54 | claude | security | Cloud Schema | Missing UPDATE RLS policies for game state tables | No |
| 55 | codex×2 | completeness, data-modeling | Random Mode | Per-round categories not modeled (random mode changes each round) | No |
| 56 | claude | data-modeling | Indexes | Missing index for timer backstop cron query | No |
| 57 | claude | data-modeling | Data Models | `is_ai` duplicated across `players` and `game_players` | No |
| 58 | claude | consistency | Round | Round JSON example omits `manual_review` status | No |
| 59 | claude | consistency | AI Integration | `ai_difficulty` enum values not mapped to named competitor profiles | No |
| 60 | claude | security | AI Prompt Injection | Custom category names not sanitized before AI prompts | No |
| 61 | codex | consistency | Authentication | Identity model conflicts across auth, API, and offline sections | No |
| 62 | claude | completeness | Game Flow | Letter selection algorithm unspecified | No |
| 63 | codex | api-design | Manual Review | Manual review host workflows missing API endpoints | No |
| 64 | codex | data-modeling | Data Retention | Retention deletes without strategy for derived aggregates | No |
| 65 | claude | accessibility | Accessibility | Alt text, focus indicators, and contrast requirements missing | **Recurring** (accessibility section added in R1 but details were incomplete) |

## Unresolved — Found in Final Review

| # | Agent(s) | Severity | Domain | Section | Title |
|---|----------|----------|--------|---------|-------|
| U1 | claude×2, codex | critical | data-modeling, scalability | Data Models | `REFRESH MATERIALIZED VIEW CONCURRENTLY` cannot run inside a Postgres trigger (acquires EXCLUSIVE lock, not allowed in transaction context) |
| U2 | claude | high | data-modeling | Data Models | Stats trigger references `gp.is_ai` but column was moved from `game_players` to `players` |
| U3 | claude | high | data-modeling | Data Models | `game_players.rank` is never populated but `games_won` in trigger depends on `rank = 1` |
| U4 | claude | high | data-modeling | Data Models | Room code `UNIQUE` constraint prevents code reuse after room closure — should be partial unique on active rooms |
| U5 | claude | high | data-modeling | Data Models | `avg_score_per_round` computed as per-answer average (`AVG(a.score)`), not per-round |
| U6 | claude×2 | medium | data-modeling, consistency | Player Stats | `fastest_answer_ms`, `strongest_category`, `weakest_category` declared in schema but never updated by trigger |
| U7 | claude, codex | critical | security | Cloud Schema (RLS) | Heartbeat UPDATE policy on `game_players` allows clients to modify any column (total_score, rank, is_host), not just `last_seen` |
| U8 | claude | critical | consistency | Cloud Schema (RLS) | Answer INSERT policy allows client writes, contradicting server-authority principle (API routes use service role key) |
| U9 | codex×2, claude | critical | consistency, resilience | Architecture | Solo/offline mode contradicts mandatory Supabase auth — anonymous auth requires initial online connection |
| U10 | codex, claude | high | completeness, consistency | Timer / Done Logic | Timer expiry: "all remaining unlocked answers are submitted as-is" but collection mechanism undefined (who sends them if client is offline?) |
| U11 | claude | medium | consistency | Player Profile | Profile JSON model doesn't include `age_group` field (present in SQL) |
| U12 | claude | medium | consistency | Room | `expires_at` not extended when game finishes (design says "30 min after game ends" but schema defaults to creation time + 1 hour) |

## Noise & False Positives (top recurring themes)

| Theme | Count | Root Cause | Why dismissed |
|-------|-------|------------|---------------|
| API versioning required | 6 | Reviewers applied SaaS production criteria | v1 family game with single client — no public API contract to version |
| Idempotency / safe retries | 5 | Over-engineering prompt | Family game scale; retries cause duplicate rounds at worst, easily fixed |
| Category IDs instead of Hebrew strings | 5 | Extensibility prompt too aggressive | Hebrew-only game per spec; i18n is explicitly a "Future Consideration" |
| Adaptive difficulty "speculative" | 4 | Scope prompt ignores spec | SPEC.md explicitly requires "difficulty adapts automatically" |
| Custom categories "adds scope" | 3 | Scope prompt ignores spec | SPEC.md explicitly includes customizable category mode |
| Realtime event versioning/ordering | 4 | Over-engineering prompt | Small-scale real-time; Supabase Realtime provides ordering by default |
| CI/CD, monitoring, runbooks | 4 | Completeness prompt too broad | Operational concerns, not architecture design |
| Capacity planning / load targets | 4 | Scalability prompt assumes SaaS | Family game for 4-8 players |
| AI provider abstraction layer | 3 | Extensibility prompt | 2 providers with simple fallback; interface adds complexity with no benefit |
| Scoring plugin/extension system | 2 | Extensibility prompt | Word game has 3 fixed scoring rules; plugin system is absurd |

### Misalignment Analysis

| Root Cause | Count | Improvement Action |
|------------|-------|--------------------|
| **Reviewers applying production-SaaS criteria to a family game** | ~35 | Scope/scalability/extensibility prompts should include project context (scale, audience). Consider a `scope_context` parameter. |
| **Spec requirements flagged as unnecessary** | ~10 | Domain prompts should cross-reference the spec document when available. Findings that contradict the spec should be auto-deprioritized. |
| **Completeness prompt flags ops/infra items in architecture docs** | ~8 | Completeness prompt should distinguish between "architecture design" and "deployment playbook" scopes. |
| **Same finding across 3+ domains/agents** | ~15 | Deduplication in the orchestrator would reduce noise. Cross-agent finding merging before classification. |

## Changes Made

```
Round 1: +246 -34 (45 issues)
Round 2: +72 -24 (20 issues)
Total:   +318 -58
```

**Key additions across both rounds:**
- New sections: Authentication Model, Accessibility, Children's Privacy (COPPA), Data Retention, Host Transfer, Timer Implementation, Manual Review Fallback, Pre-generated Word Lists, Supabase Outage Degradation, API Contracts
- Schema fixes: `players.is_ai`, `players.age_group`, `answers.player_id` FK, `game_players.is_host`/`last_seen`, `rounds.categories`, `game_sessions.used_categories`, `rooms.expires_at`, indexes
- AI integration: circuit breaker (Supabase-backed), total failure path, word list fallback, validation batching clarification
- Security: join rate limiting, custom category sanitization, UPDATE RLS policies
- Scoring: server-side timestamps, TIMESTAMPTZ arithmetic fix, transaction boundary for `is_unique`

## Prompt Improvement Assessment

| Signal | Recommended Level | File |
|--------|-------------------|------|
| Both agents consistently flag scope items that are spec-required | **Global** | `global/prompts/design-review/*/scope.md` — add instruction to cross-reference spec when available |
| Extensibility domain generates >50% noise on single-purpose apps | **Repo config** | Consider `disabled_domains: [extensibility]` for simple projects |
| All agents miss the REFRESH MATERIALIZED VIEW Postgres constraint | **Global** (all agents) | `global/prompts/design-review/*/data-modeling.md` — add check for DDL validity inside triggers |
| Completeness prompt flags ops items in architecture docs | **Global** | `global/prompts/design-review/*/completeness.md` — distinguish architecture vs deployment scope |

---

*Generated by stark-review-design | 2 fix rounds + 1 final review | 66 sub-agent dispatches (66 succeeded)*
