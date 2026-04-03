# DESIGN.md — Design-to-Plan Cross-Review Summary

**Date:** 2026-04-03
**Design file:** `DESIGN.md`
**Plans generated:** 2/3 (claude timed out)
**Reviews completed:** 2/2

## Scorecard

| Agent   | Complete | Feasible | Phasing | Risk | Testable | Avg  |
|---------|----------|----------|---------|------|----------|------|
| codex   | 9        | 10       | 8       | 9    | 9        | **9.0** ★ |
| gemini  | 5        | 4        | 6       | 5    | 5        | 5.0  |

**Winner:** codex (9.0/10)

## Per-Plan Review Details

### codex plan (reviewed by gemini — 9.0/10)

**Strengths:**
- Identified and correctly resolved the Postgres transaction limitation of running `REFRESH MATERIALIZED VIEW CONCURRENTLY` inside a trigger by designing an async queue worker
- Exceptional architectural phasing: isolates core logic by implementing deterministic solo gameplay with fallback word-lists (Phase 3) before introducing server authority (Phase 4) and flaky AI dependencies (Phase 5)
- Provides highly concrete, actionable verification commands (curl, vitest, playwright) and explicit, phase-specific rollback strategies

**Weaknesses:**
1. Missed frontend parallelization opportunity: Phase 3 UI tasks unnecessarily blocked by Phase 2 infrastructure
2. Unsafe local storage rehydration: no schema versioning for LocalStorage crash recovery
3. Timer backstop UI hang: client could wait up to 29s at timer zero before server cron fires

### gemini plan (reviewed by codex — 5.0/10)

**Strengths:**
- Phase 1 correctly prioritizes Supabase-backed auth, database-backed rate limiting, and Claude→OpenAI fallback/circuit-breaker
- Preserves the design's authoritative timer model
- Frontend solo track parallel to multiplayer state-machine track

**Weaknesses:**
1. Missing several required API routes from design contract (`/api/player`, `/api/game/done`, `/api/game/end`, `/api/game/review`, `/api/game/[id]`)
2. Static validation conflates word-list fallback with actual validation — design requires different fallbacks for solo vs multiplayer
3. Auth verification uses anon key as bearer token instead of real anonymous-auth JWT
4. No executable mechanism specified for Realtime event emission
5. Scoring engine placed after integration phase — but scoring is needed for integration
6. Incomplete accessibility coverage (missing text labels, fieldset/legend, aria-describedby, focus return, touch targets, alt/aria-label, contrast)
7. Missing operational jobs: room expiry, timer backstop, disconnect marking, abandoned player scoring, profile soft-delete, stats recalculation after retention
8. Missing rate limit enforcement: 200 AI calls/game, 30 AI calls/min/IP, 10 global concurrent, 2 help uses/round, join cooldown, 5s DB timeout
9. Timer crash recovery overpromised vs design's actual persistence model
10. Rollback plan references non-existent Supabase SDK long-polling fallback

## Synthesis Decisions

| Decision | Source | Rationale |
|----------|--------|-----------|
| 7-phase structure with contracts-first approach | codex | More thorough, correctly identifies design gaps as prerequisites |
| Phase 2/3 parallelization | gemini (idea), synthesized into codex structure | UI scaffolding has no runtime dependency on infrastructure |
| LocalStorage schema versioning | gemini review weakness | Prevents crash on state model evolution |
| Timer backstop UI optimistic transition | gemini review weakness | Eliminates up-to-29s hang at timer zero |
| All other structure and content | codex | Scored 9.0/10, addressed design requirements comprehensively |
