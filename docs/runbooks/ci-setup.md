# CI Setup

## Required GitHub Secrets

| Secret | Purpose | Where to get |
|--------|---------|-------------|
| `SUPABASE_ACCESS_TOKEN` | Terraform provider auth | Supabase dashboard > Account > Access Tokens |
| `SUPABASE_PROJECT_REF` | Identifies the Supabase project | Supabase dashboard > Project Settings > General |
| `SUPABASE_DB_PASSWORD` | Database access for migrations | Set during project creation |
| `ANTHROPIC_API_KEY` | Claude API for AI validation | Anthropic Console > API Keys |
| `OPENAI_API_KEY` | GPT fallback for AI validation | OpenAI Platform > API Keys |
| `VERCEL_API_TOKEN` | Deployment automation | Vercel dashboard > Settings > Tokens |
| `VERCEL_TEAM_ID` | Vercel team scope | Vercel dashboard > Settings > General |

## Runner Configuration

- **OS:** Ubuntu latest (ubuntu-latest)
- **Node.js:** 22 (matches `.nvmrc`)
- **Package manager:** pnpm 10 (matches `packageManager` in `package.json`)
- **Docker:** Not required for CI (Supabase local is only for local dev)

## CI Jobs

| Job | Blocking | What it does |
|-----|----------|-------------|
| `preflight` | No | Validates secret documentation expectations |
| `lint` | Yes | Runs `pnpm lint` (ESLint via next lint) |
| `typecheck` | Yes | Runs `pnpm typecheck` (tsc --noEmit) |
| `unit-tests` | Yes | Runs `pnpm test` (vitest) |
| `playwright` | Yes | Runs Playwright E2E tests (chromium only in CI) |
| `dependency-audit` | Yes (critical/high) | `pnpm audit` — fails on critical/high advisories |
| `secret-scanning` | Yes | Grep-based scan for leaked API keys/tokens |
| `sast` | Yes (SQL injection) | Checks for eval(), dangerouslySetInnerHTML, SQL interpolation |

## Adding a New Secret

1. Go to GitHub repo > Settings > Secrets and variables > Actions
2. Click "New repository secret"
3. Add the secret name and value
4. Update this document if the secret is used by CI

## Test Environment Variables

CI jobs that run tests use dummy environment variable values (not real secrets) to satisfy module imports. These are defined inline in the workflow file. Real Supabase/AI keys are only needed for integration tests that hit live services (currently skipped in CI).

## Playwright in CI

- Only the Chromium project runs in CI (Mobile Safari is local-dev only)
- Retries: 2 (via `playwright.config.ts` CI detection)
- Workers: 1 (sequential for stability)
- Reports uploaded as artifacts with 14-day retention
