# ADR 0002: Children's Data Compliance

**Status:** Accepted
**Date:** 2026-04-03

## Context

The primary player is 9 years old. Israel's Privacy Protection Law (1981) and the Privacy Protection Regulations (Data Security) 2017 apply. While Israel does not have a direct COPPA equivalent, the Protection of Privacy Law covers minors, and the Israeli Privacy Protection Authority has issued guidelines on children's data.

## Decisions

### Data Collection Policy

**Collected:**
- Display name (not required to be real name)
- Avatar selection (from predefined set)
- Game answers (Hebrew words — not personal information)
- Game scores and statistics
- Anonymous auth session (Supabase UUID, no email/password)

**Not collected:**
- Email address (unless optional account upgrade in future)
- Real name, date of birth, or exact age
- Location or device identifiers
- Photos or user-generated media
- Contact information of any kind

**Not used:**
- Analytics SDKs or tracking pixels
- Advertising networks
- Third-party cookies
- Social login providers

### AI Data Handling

Player answers are sent to Claude API and OpenAI API for validation. These are single Hebrew words in game categories (countries, cities, animals, etc.) — not personal information.

- Both Anthropic and OpenAI API terms prohibit training on API data.
- No player identifiers are included in AI prompts. Only the game letter and answer text are sent.
- AI responses are validated against a strict schema and discarded after scoring.

### Parental Consent Approach

**v1 (current):** Parental consent is not required because:
- Anonymous auth collects no PII.
- No email, real name, or identifying information is requested.
- The app is designed for supervised family use on shared devices.

**Future (if email linking is added):** Before allowing users to link an email:
- Display a parental consent gate asking if the user is under 16.
- If under 16, require a parent's email for consent verification.
- Use a simple email confirmation flow (not a complex identity verification).

### Data Retention Windows

| Data Type | Retention | Cleanup Method |
|---|---|---|
| Active game sessions | Until game ends + room expiry | Room cleanup Edge Function (every 15 min) |
| Completed game data | 1 year | Monthly retention cleanup Edge Function |
| Player profiles | Indefinite while active | Soft-delete after 1 year of inactivity |
| Anonymous auth sessions | Until browser clears storage | Supabase auto-cleanup of inactive anon users |
| AI prompt/response logs | Not persisted | In-memory only during request processing |
| LocalStorage (solo) | Indefinite (user's device) | User can clear browser data |

### Anonymous Auth Cleanup Policy

Supabase anonymous auth sessions accumulate over time. Cleanup policy:
- Anonymous users with no associated `players` table record after 24 hours are eligible for deletion.
- Anonymous users whose linked player profile has been soft-deleted (inactive >1 year) are eligible for deletion.
- Cleanup runs as part of the monthly `retention-cleanup` Edge Function.
- Active anonymous users (those with game activity in the last year) are never cleaned up.

## Consequences

- The app can be used by children without parental consent in v1.
- No PII is collected, reducing regulatory burden and data breach risk.
- If email linking is added later, a consent flow must be built before that feature ships.
- AI providers never receive identifying information about players.
- Stale auth sessions are cleaned up to avoid database bloat.
