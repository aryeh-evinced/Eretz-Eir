# Deployment Runbook

## Deployment Order

1. **Migrations first** — Forward migrations applied in sequence order
2. **Verify staging** — Tests run against migrated schema
3. **Canary deploy** — Vercel preview deployment
4. **Canary validate** — Smoke tests + metric monitoring
5. **Promote** — Production only: requires security checklist

## Environments

| Environment | Trigger | Approval |
|------------|---------|----------|
| Staging | Push to main, or manual dispatch | Automatic |
| Production | Manual dispatch only | Requires security checklist + environment protection |

## Rollback Triggers

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate | > 1% for 5 min | Revert Vercel deployment |
| AI fallback rate | > 20% sustained | Set `FEATURE_AI_ENABLED=false` |
| Round backstop fire rate | > baseline + 2σ | Disable multiplayer |
| Post-deploy smoke fail | Any failure | Immediate rollback |

## Manual Rollback

```bash
# Revert to previous deployment
npx vercel rollback --token=$VERCEL_API_TOKEN

# Disable features without redeployment
# Set in Vercel dashboard → Environment Variables:
FEATURE_MULTIPLAYER_ENABLED=false
FEATURE_AI_ENABLED=false
```

## Migration Rollback

```bash
# List down migrations in reverse order
ls -r supabase/migrations/*_down.sql

# Apply a specific down migration
supabase db push --linked < supabase/migrations/NNNN_xxx_down.sql
```

**Before production migrations:**
1. Confirm PITR backup exists (Supabase dashboard)
2. Note the current timestamp as restore point
3. Apply migrations
4. Verify — if anything fails, restore from PITR

## PITR Recovery

- **RPO:** 1 hour of game data
- **RTO:** 2 hours
- **Process:** Supabase dashboard → Database → Point in Time Recovery → Select timestamp

## Required Secrets

See `docs/runbooks/ci-setup.md` for the full list. Deploy additionally needs:
- `SUPABASE_SERVICE_ROLE_KEY` — for staging verification
- `VERCEL_PROJECT_ID` — as a Vercel variable (not secret)
- Environment-specific `NEXT_PUBLIC_*` variables set in Vercel dashboard

## Pre-Production Checklist

- [ ] `docs/runbooks/security-checklist.md` exists and is committed
- [ ] All CI checks passing on main
- [ ] Staging canary deployed and validated
- [ ] PITR backup confirmed for current production state
