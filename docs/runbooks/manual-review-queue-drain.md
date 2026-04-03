# Manual Review Queue Drain

## Symptoms
- Rounds stuck in `manual_review` status
- Players waiting for host to review answers
- Game flow blocked

## Diagnosis

Check for stuck rounds:

```sql
SELECT r.id, r.game_id, r.status, r.ended_at,
       EXTRACT(EPOCH FROM (now() - r.ended_at)) AS stuck_seconds
FROM rounds r
WHERE r.status = 'manual_review'
ORDER BY r.ended_at ASC;
```

Rounds in `manual_review` for > 120 seconds should have been auto-accepted.

## Resolution

### Automatic Recovery
The `checkManualReviewTimeout` function auto-accepts reviews after 2 minutes.
This is checked by the `done` and `timer-expired` route handlers.

### Manual Drain
If auto-accept isn't firing (e.g., no subsequent requests triggering the check):

```sql
-- Auto-accept all stale manual reviews
UPDATE rounds
SET status = 'completed'
WHERE status = 'manual_review'
  AND ended_at < now() - INTERVAL '2 minutes';
```

### Via Application Code
The `drainTimedOutReviews` function can be called from a scheduled job:

```typescript
import { drainTimedOutReviews } from "@/lib/game/manualReview";
import { createAdminClient } from "@/lib/supabase/admin";

const supabase = createAdminClient();
const { drained } = await drainTimedOutReviews(supabase);
console.log(`Drained ${drained} timed-out reviews`);
```

## Root Causes
1. **Host disconnected** — no one to review. Auto-accept handles this.
2. **AI validation entirely failed** — both providers down + word-list fallback also failed. Rare.
3. **Bug in timer-expired handler** — not checking manual review timeout.

## Prevention
- The 2-minute timeout is independent of the round-backstop Edge Function
- Solo mode never enters manual_review (degrades to optimistic letter-only acceptance)
- Monitor `manual_review` round count as a health metric
