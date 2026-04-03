import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderResultImage, type ShareImageData } from "@/lib/share/renderResultImage";
import { logger } from "@/lib/observability/logger";

const schema = z.object({
  game_id: z.string().uuid(),
  player_id: z.string().uuid(),
});

/**
 * GET /api/share?game_id=...&player_id=...
 *
 * Returns a PNG image of the game results for sharing.
 * The image is generated server-side using Satori + resvg-wasm.
 *
 * Designed for og:image / WhatsApp preview compatibility:
 * - 1200x630 PNG
 * - Hebrew text rendered with embedded Heebo font
 * - Dark theme matching the app's design system
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const raw = {
    game_id: searchParams.get("game_id"),
    player_id: searchParams.get("player_id"),
  };

  let parsed;
  try {
    parsed = schema.parse(raw);
  } catch {
    return Response.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "game_id and player_id required" } },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // Fetch game
  const { data: game } = await supabase
    .from("game_sessions")
    .select("id, status")
    .eq("id", parsed.game_id)
    .single();

  if (!game) {
    return Response.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Game not found" } },
      { status: 404 },
    );
  }

  // Fetch all players in this game with their ranks and names
  const { data: gamePlayers } = await supabase
    .from("game_players")
    .select("player_id, score_total, rank")
    .eq("game_id", parsed.game_id)
    .order("rank", { ascending: true });

  const gpRows = (gamePlayers ?? []) as Array<{
    player_id: string;
    score_total: number;
    rank: number | null;
  }>;

  if (gpRows.length === 0) {
    return Response.json(
      { ok: false, error: { code: "NOT_FOUND", message: "No players found for game" } },
      { status: 404 },
    );
  }

  // Fetch player profiles
  const playerIds = gpRows.map((r) => r.player_id);
  const { data: players } = await supabase
    .from("players")
    .select("id, name, avatar")
    .in("id", playerIds);

  const playerRows = (players ?? []) as Array<{ id: string; name: string; avatar: string }>;
  const playerMap = new Map(playerRows.map((p) => [p.id, p]));

  // Find the requesting player
  const requestingGp = gpRows.find((r) => r.player_id === parsed.player_id);
  const requestingPlayer = playerMap.get(parsed.player_id);

  if (!requestingGp || !requestingPlayer) {
    return Response.json(
      { ok: false, error: { code: "NOT_FOUND", message: "Player not found in game" } },
      { status: 404 },
    );
  }

  const shareData: ShareImageData = {
    playerName: requestingPlayer.name,
    playerAvatar: requestingPlayer.avatar || "🦊",
    playerRank: requestingGp.rank ?? gpRows.length,
    totalPlayers: gpRows.length,
    totalScore: requestingGp.score_total ?? 0,
    topPlayers: gpRows.slice(0, 3).map((gp) => {
      const p = playerMap.get(gp.player_id);
      return {
        name: p?.name ?? "שחקן",
        avatar: p?.avatar ?? "🎮",
        score: gp.score_total ?? 0,
        rank: gp.rank ?? 0,
      };
    }),
  };

  try {
    const pngBuffer = await renderResultImage(shareData);

    return new Response(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Content-Disposition": `inline; filename="eretz-eir-results.png"`,
      },
    });
  } catch (err) {
    logger.error("Share image generation failed", {
      gameId: parsed.game_id,
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json(
      { ok: false, error: { code: "RENDER_ERROR", message: "Failed to generate share image" } },
      { status: 500 },
    );
  }
}
