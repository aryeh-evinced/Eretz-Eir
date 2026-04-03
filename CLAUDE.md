# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Eretz-Eir (ארץ עיר) is a digital Hebrew word game where a letter is drawn and players race to fill in words starting with that letter across categories (country, city, animal, plant, etc.). Solo mode with AI competitors, multiplayer via room codes. Primary player is a 9-year-old; the UI must be kid-friendly.

**Current state:** Design phase. `index.html` is a static UI prototype (vanilla HTML/CSS/JS). `SPEC.md` has game rules, `DESIGN.md` has the full technical architecture. No framework scaffolded yet.

## Planned Tech Stack

- **Frontend:** Next.js App Router, React, Tailwind CSS, Zustand for state
- **Backend:** Next.js API Route Handlers (thin proxy to AI + game logic authority)
- **Database:** Supabase (Postgres + Realtime WebSockets + Auth + RLS)
- **AI:** Claude API (primary, claude-sonnet-4-20250514) with OpenAI fallback (gpt-4o-mini)
- **Hosting:** Vercel
- **Fonts:** Heebo (body) + Rubik (headings/letter display)

## Key Architectural Decisions

- **All UI is Hebrew, RTL.** Root element must have `dir="rtl"` and `lang="he"`.
- **AI calls never go directly from client.** All AI traffic goes through Next.js Route Handlers to protect API keys and enforce rate limits.
- **Dual storage:** LocalStorage for solo/offline, Supabase for multiplayer. Local-first, cloud-authoritative for multiplayer.
- **Server is state authority** for multiplayer. Clients send actions; server validates transitions and broadcasts via Supabase Realtime channels.
- **Answer validation is batched:** one AI call per player per round (all categories in one prompt). All players validated in parallel.
- **Fuzzy matching for Hebrew answers:** normalize (strip niqqud, geresh, whitespace) then Levenshtein distance threshold.

## Scoring Rules

- Unique valid answer: 10 pts. Shared valid answer: 5 pts. Invalid/empty: 0 pts. First valid answer in category: +3 speed bonus.
- Help usage (2 per round): first click = hint, second click = auto-fill. No score penalty, but visible to other players.

## Design Reference

- Color scheme defined in `index.html` CSS variables (`:root` block): dark theme with accent (#e94560), gold (#f5c842), teal (#0ff0b3).
- Mobile-first responsive design. Primary devices are phones and tablets.
