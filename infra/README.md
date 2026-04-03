# Infrastructure

Eretz-Eir cloud infrastructure managed with Terraform + Supabase CLI.

## Environments

| Environment | Purpose | Branch |
|-------------|---------|--------|
| `staging` | Integration testing, QA, PR previews | `main` |
| `production` | Live game traffic | tagged releases |

Each environment has its own Supabase project and Vercel deployment. They share no data.

## First-time Setup

### Prerequisites

- Terraform ≥ 1.5 (`brew install terraform`)
- Supabase CLI (`brew install supabase/tap/supabase`)
- Vercel CLI (optional — Terraform manages the project)

### Configure remote state backend

Edit `infra/terraform/main.tf` and uncomment either the **Terraform Cloud** or **S3** backend block. Fill in your bucket/organization details.

### Set environment variables

Copy `.env.example` to `.env.staging` / `.env.production` and fill in all values:

```
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_ORGANIZATION_ID=...
SUPABASE_DB_PASSWORD=...        # min 16 characters
VERCEL_API_TOKEN=...
VERCEL_TEAM_ID=...              # optional
```

### Bootstrap an environment

```bash
# Load secrets (never commit these files)
set -a && source .env.staging && set +a

ENVIRONMENT=staging ./infra/scripts/bootstrap.sh
```

The bootstrap script is **idempotent** — safe to run multiple times. It will:

1. `terraform apply` — create or update Supabase + Vercel resources
2. `supabase link` — link CLI to the provisioned project
3. `supabase db push` — apply all pending migrations
4. Deploy all Edge Functions

## Staging vs Production Differences

| Aspect | Staging | Production |
|--------|---------|------------|
| Supabase project | separate project | separate project |
| Vercel project | preview deployments | production traffic |
| `FEATURE_MULTIPLAYER_ENABLED` | `true` | `true` |
| `AI_MONTHLY_BUDGET_USD` | `10` | `50` |
| `prevent_destroy` | false | **true** (Terraform lifecycle) |

## Applying Migrations Only

```bash
supabase link --project-ref <REF>
supabase db push
```

## Rolling Back a Migration

```bash
# Apply the corresponding down migration manually:
supabase db execute --file supabase/migrations/0003_policies_down.sql
```

Down migrations live alongside each forward migration:
- `0001_core_tables.sql` / `0001_core_tables_down.sql`
- `0002_indexes.sql` / `0002_indexes_down.sql`
- `0003_policies.sql` / `0003_policies_down.sql`
- `0004_rpc.sql` / `0004_rpc_down.sql`
- `0005_cron_schedules.sql` / `0005_cron_schedules_down.sql`
