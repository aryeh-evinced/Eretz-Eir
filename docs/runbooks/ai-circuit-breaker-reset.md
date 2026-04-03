# AI Circuit Breaker Reset

## Symptoms
- All AI validation falling back to word-list mode
- Logs show "circuit breaker: provider unavailable" for both Claude and OpenAI
- Players not receiving AI-powered hints or competitor answers

## Diagnosis

Check circuit breaker state in Supabase:

```sql
SELECT key, count, window_start
FROM rate_limits
WHERE key LIKE 'circuit:%';
```

- `count >= 3` with `window_start` in the future = circuit is OPEN
- `count >= 3` with `window_start` in the past = circuit is HALF-OPEN (next call is a probe)
- `count < 3` = circuit is CLOSED (normal operation)

## Resolution

### Automatic Recovery
Circuits auto-recover after 30 seconds (OPEN -> HALF-OPEN). A single successful probe call closes the circuit.

### Manual Reset
If the underlying provider issue is resolved and you want to skip the cooldown:

```sql
UPDATE rate_limits
SET count = 0, window_start = now()
WHERE key IN ('circuit:claude', 'circuit:openai');
```

### If Provider Is Down
If a provider is experiencing an extended outage:
1. The game continues in word-list fallback mode (no player impact beyond reduced AI features)
2. Monitor provider status pages:
   - Claude: https://status.anthropic.com
   - OpenAI: https://status.openai.com
3. Circuits will auto-recover once the provider responds

## Prevention
- Monitor circuit breaker state as part of health checks
- Set alerts for sustained open circuit states (> 5 minutes)
