# ADR 0001: Core Contracts

**Status:** Accepted
**Date:** 2026-04-03

## Context

During design review, several architectural decisions were identified as unresolved or inconsistent between SPEC.md and DESIGN.md. These must be frozen before implementation begins.

## Decisions

### 1. Room Codes: 4 Digits for v1

SPEC.md allows 4-6 digits; DESIGN.md assumes 4. We lock to **4-digit codes** (0000-9999) for v1.

**Rationale:** 10,000 codes is sufficient for a family game. The rate-limiting design (5 attempts/min/IP) already assumes 4 digits. Shorter codes are easier for kids to type and share verbally.

### 2. Offline Identity: Local Provisional Player ID

Offline solo mode cannot depend on Supabase anonymous auth. The identity model is:

- On first app open, generate a local UUID (`crypto.randomUUID()`) stored in LocalStorage as `eretz-eir:player.id`.
- This UUID is the player's identity for all solo/offline operations.
- When the app detects network connectivity and Supabase is reachable, call `signInAnonymously()` to obtain a Supabase auth UUID.
- If the local UUID differs from the Supabase auth UUID, migrate local data to the Supabase identity and update the local record. This migration happens exactly once.
- For multiplayer, the Supabase auth UUID is required. The app prompts the user to go online if they attempt multiplayer while offline.

### 3. Replace Trigger-Side REFRESH MATERIALIZED VIEW with Queue + Worker

`REFRESH MATERIALIZED VIEW CONCURRENTLY` cannot safely run inside the `update_player_stats()` trigger because it acquires an exclusive lock and can deadlock under concurrent game finalization.

**New approach:**
- The trigger inserts affected `player_id` values into a `stats_refresh_queue` table.
- A scheduled Supabase Edge Function (`stats-refresh`) runs every 60 seconds, drains the queue, recomputes `player_stats`, and then runs `REFRESH MATERIALIZED VIEW CONCURRENTLY player_category_stats`.
- The trigger itself only updates `player_stats` (lightweight row-level upsert). The materialized view refresh is fully async.

### 4. Heartbeat: RPC Primary, API Route Secondary

RLS cannot safely allow direct `UPDATE` on `game_players` if only `last_seen` should change (a broad UPDATE policy would allow clients to modify `total_score`, `rank`, etc.).

**Solution:**
- **Primary:** A Supabase RPC function `heartbeat(game_id uuid)` that updates only `game_players.last_seen` for the calling user (`auth.uid()`). This is callable via the Supabase client with the anon key.
- **Secondary:** An API route `POST /api/game/heartbeat` for cases where the RPC is unreachable but the Next.js backend is available.
- The `presence-scan` Edge Function (every 30s) checks `last_seen` and marks players as disconnected after 45s of silence.

### 5. Remove Direct Client `answers` Table Writes

The server is the scoring authority. Clients must not insert or update `answers` directly.

**Change:** Remove the RLS policy `"Players can insert own answers"` from the design. All answer writes go through:
- `POST /api/game/done` — player submits answers; the route handler inserts them using the service role key.
- AI validation and scoring fields are set server-side in the same transaction.

The `answers` table remains readable by game participants (after round ends) via RLS.

### 6. Rank and Stats Computation Path

- `game_players.rank` is computed during game finalization (`POST /api/game/end`). The route handler calculates final scores, sorts players, assigns ranks, and persists them in a single transaction.
- `player_stats` fields (`fastest_answer_ms`, `strongest_category`, `weakest_category`) are computed by the `stats-refresh` worker from the `answers` and `rounds` tables. These fields are eventually consistent (up to 60s delay).

## Consequences

- Solo offline mode works without any network dependency.
- Materialized view refreshes cannot block game finalization transactions.
- No client can tamper with scoring, ranking, or answer validation.
- Heartbeat is efficient and cannot be abused to modify game state.
- Stats may be up to 60 seconds stale on the profile page — acceptable for a family game.
