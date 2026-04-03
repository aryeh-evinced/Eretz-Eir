# Capacity Planning

## v1 Targets

| Metric | Target | Measured |
|--------|--------|----------|
| Concurrent game sessions | 50 | Pending load test |
| P95 end-to-end latency | < 2000ms | Pending load test |
| P95 health check latency | < 500ms | Pending load test |
| Error rate under load | < 1% | Pending load test |
| Connection pool exhaustion | None at 50 sessions | Pending load test |

## Load Test

### Setup

```bash
# Install k6
brew install k6

# Start local server
pnpm dev

# Seed test tokens (if available)
source .env.test

# Run load test
k6 run --env BASE_URL=http://localhost:3000 \
       --env AUTH_TOKEN=$E2E_PLAYER_TOKEN \
       tests/load/concurrent-players.k6.ts
```

### Scenarios

The load test ramps from 1 to 50 concurrent virtual users over 2 minutes, holds at peak for 3 minutes, then ramps down. Each VU runs a full game lifecycle:

1. Health check
2. Create game
3. Join game
4. Start game
5. Submit answers (done)
6. End game
7. Heartbeat

### Thresholds

| Metric | P95 Threshold | Alert |
|--------|--------------|-------|
| `game_create_duration` | < 2000ms | Fail |
| `game_join_duration` | < 2000ms | Fail |
| `game_start_duration` | < 2000ms | Fail |
| `answer_submit_duration` | < 2000ms | Fail |
| `game_end_duration` | < 2000ms | Fail |
| `health_check_duration` | < 500ms | Fail |
| `success_rate` | > 99% | Fail |
| `http_req_failed` | < 1% | Fail |

## Bottleneck Analysis

### Database Connection Pool

Supabase free tier: 60 connections. Each game operation uses 1 connection briefly. At 50 concurrent sessions with ~1 req/sec each, peak concurrent DB connections should be ~10-15. Monitor via:

```sql
SELECT count(*) FROM pg_stat_activity WHERE state = 'active';
```

### Realtime Channels

Each multiplayer game creates 1 Supabase Realtime channel. At 50 concurrent games, that's 50 channels with 2-4 subscribers each (100-200 WebSocket connections). Supabase free tier supports ~200 concurrent Realtime connections.

### AI Validation

AI validation is the slowest operation (2-5s per call). Concurrent limit (`lib/ai/budget.ts`) caps simultaneous AI calls. Under load, excess requests degrade to word-list validation.

### Vercel Serverless

Free tier: 12 concurrent serverless function executions. Pro tier: 1000. If the load test shows queueing at 50 sessions, upgrade to Pro or optimize cold starts.

## Scaling Notes

- **Horizontal:** Vercel auto-scales serverless functions. No manual scaling needed.
- **Database:** If connection pool becomes a bottleneck, enable Supabase's connection pooler (PgBouncer).
- **Realtime:** If WebSocket connections exceed limits, consider batching game state updates.
- **AI:** Increase concurrent AI call limit cautiously; each call costs money and has provider rate limits.
