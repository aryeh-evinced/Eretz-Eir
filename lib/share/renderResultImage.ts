/**
 * Server-side result image generation using Satori + @resvg/resvg-wasm.
 *
 * Produces a WhatsApp-friendly PNG (1200x630) summarizing game results.
 * Uses dynamic imports to avoid bundling in the client.
 *
 * Flow: React element → Satori (SVG) → @resvg/resvg-wasm (PNG)
 */

import type { ReactNode } from "react";

export interface ShareImageData {
  playerName: string;
  playerAvatar: string;
  playerRank: number;
  totalPlayers: number;
  totalScore: number;
  topPlayers: Array<{
    name: string;
    avatar: string;
    score: number;
    rank: number;
  }>;
}

// Lazy-loaded font data (cached after first call)
let _fontData: ArrayBuffer | null = null;

async function loadFont(): Promise<ArrayBuffer> {
  if (_fontData) return _fontData;

  // Fetch Heebo Bold from Google Fonts CDN for Hebrew rendering.
  // This is a server-side fetch — no client bundle impact.
  const response = await fetch(
    "https://fonts.gstatic.com/s/heebo/v26/NGSpv5_NC0k9P_v6ZUCbLRAHxK1EiS2cckOnz02SXQ.woff",
    { next: { revalidate: 86400 } }, // cache for 24h
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch font: ${response.status}`);
  }

  _fontData = await response.arrayBuffer();
  return _fontData;
}

// resvg-wasm initialization guard
let _resvgInitialized = false;

/**
 * Render a share image as PNG buffer.
 * Must be called server-side only (Route Handler or Server Action).
 */
export async function renderResultImage(data: ShareImageData): Promise<Buffer> {
  // Dynamic imports — keeps Satori and resvg out of the client bundle
  const satori = (await import("satori")).default;
  const { Resvg, initWasm } = await import("@resvg/resvg-wasm");

  // Initialize resvg-wasm (once per process)
  if (!_resvgInitialized) {
    try {
      // In Vercel Edge Functions, the WASM file is auto-resolved.
      // In Node.js, we need to initialize explicitly.
      await initWasm(
        fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm"),
      );
      _resvgInitialized = true;
    } catch {
      // Already initialized (e.g., hot reload) — that's fine
      _resvgInitialized = true;
    }
  }

  const fontData = await loadFont();

  const WIDTH = 1200;
  const HEIGHT = 630;

  // Build the React element tree for Satori.
  // Satori supports a subset of CSS via Flexbox — no Tailwind here.
  const element = buildShareElement(data);

  const svg = await satori(element as ReactNode, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      {
        name: "Heebo",
        data: fontData,
        weight: 700,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
  });

  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

const RANK_EMOJIS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function buildShareElement(data: ShareImageData) {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        backgroundColor: "#0f0f1a",
        color: "#eaeaea",
        fontFamily: "Heebo",
        direction: "rtl",
        padding: "40px",
      },
      children: [
        // Title
        {
          type: "div",
          props: {
            style: {
              fontSize: 56,
              fontWeight: 700,
              background: "linear-gradient(135deg, #e94560, #f5c842, #0ff0b3)",
              backgroundClip: "text",
              color: "transparent",
              marginBottom: 20,
            },
            children: "ארץ עיר",
          },
        },
        // Player result
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 30,
            },
            children: [
              {
                type: "span",
                props: {
                  style: { fontSize: 48 },
                  children: data.playerAvatar,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column" as const,
                    alignItems: "center",
                  },
                  children: [
                    {
                      type: "span",
                      props: {
                        style: { fontSize: 36, fontWeight: 700 },
                        children: data.playerName,
                      },
                    },
                    {
                      type: "span",
                      props: {
                        style: {
                          fontSize: 28,
                          color: data.playerRank === 1 ? "#f5c842" : "#8888a8",
                        },
                        children: `${RANK_EMOJIS[data.playerRank] ?? ""} מקום ${data.playerRank} מתוך ${data.totalPlayers}`,
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        // Score
        {
          type: "div",
          props: {
            style: {
              fontSize: 72,
              fontWeight: 700,
              color: "#f5c842",
              marginBottom: 30,
            },
            children: `${data.totalScore} נק'`,
          },
        },
        // Top players
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              gap: 24,
              marginTop: 10,
            },
            children: data.topPlayers.slice(0, 3).map((p) => ({
              type: "div",
              key: p.name,
              props: {
                style: {
                  display: "flex",
                  flexDirection: "column" as const,
                  alignItems: "center",
                  backgroundColor: "#1a1a2e",
                  borderRadius: 12,
                  padding: "16px 24px",
                  minWidth: 120,
                  border: p.rank === 1 ? "2px solid #f5c842" : "1px solid #2a2a4a",
                },
                children: [
                  {
                    type: "span",
                    props: {
                      style: { fontSize: 28 },
                      children: RANK_EMOJIS[p.rank] ?? `#${p.rank}`,
                    },
                  },
                  {
                    type: "span",
                    props: {
                      style: { fontSize: 24 },
                      children: p.avatar,
                    },
                  },
                  {
                    type: "span",
                    props: {
                      style: { fontSize: 18, fontWeight: 700, marginTop: 4 },
                      children: p.name,
                    },
                  },
                  {
                    type: "span",
                    props: {
                      style: {
                        fontSize: 22,
                        fontWeight: 700,
                        color: p.rank === 1 ? "#f5c842" : "#eaeaea",
                      },
                      children: `${p.score}`,
                    },
                  },
                ],
              },
            })),
          },
        },
      ],
    },
  };
}
