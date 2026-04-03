# ADR 0003: Share Image Generation

**Status:** Accepted
**Date:** 2026-04-03

## Context

The game-over screen includes a "Share to WhatsApp" button that generates a result image showing final rankings and highlights. This image must be generated server-side for Open Graph previews and client-side for direct sharing.

## Decision

Use **Satori + @resvg/resvg-wasm** for share image generation.

### Why This Approach

- **Satori** (by Vercel) converts JSX/HTML to SVG. It runs in both Node.js and Edge Runtime, making it Vercel-compatible without native dependencies.
- **@resvg/resvg-wasm** converts SVG to PNG. The WASM variant avoids native binary dependencies that break on Vercel's serverless/edge environments.
- This is the same stack used by Vercel's `@vercel/og` (next/og) for Open Graph images.

### Alternatives Considered

| Approach | Why Rejected |
|---|---|
| Puppeteer / Playwright | Requires headless Chrome. Too heavy for serverless, cold start >5s. |
| Canvas (node-canvas) | Native dependency (Cairo). Doesn't work on Vercel Edge. |
| html2canvas (client-side) | Runs in browser only. Can't generate OG images for link previews. |
| @vercel/og directly | Viable but less flexible for custom layouts. Satori gives more control. |

### Implementation Plan

- **OG images** (link previews): Generated via a Next.js Route Handler at `/api/og/game/[id]` using Satori + resvg-wasm. Cached with appropriate headers.
- **Share images** (direct sharing): Generated client-side using the same Satori + resvg-wasm stack, dynamically imported only on the game-over screen to avoid bloating the main bundle.
- **Hebrew font support**: Satori requires font files to be loaded explicitly. The Heebo font file will be bundled with the OG image route handler.

## Consequences

- Share images work on Vercel without native dependencies.
- The same rendering logic is reusable for both OG previews and direct share images.
- Satori and resvg-wasm are loaded lazily — no impact on game performance.
- Hebrew text rendering requires explicit font loading in Satori (not automatic from CSS).
