"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";

interface ShareButtonProps {
  /** Game ID — reserved for image share URL generation (Task #43) */
  gameId: string;
  playerName: string;
  playerRank: number;
  totalPlayers: number;
  totalScore: number;
}

/**
 * Share button for the game-over screen.
 * Phase 6: text-based sharing (WhatsApp-friendly).
 * Phase 6 Task 4 will add image generation via Satori.
 */
export function ShareButton({
  gameId: _gameId,
  playerName,
  playerRank,
  totalPlayers,
  totalScore,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareText = [
    `🎮 ארץ עיר — סיימתי!`,
    `${playerName} מקום ${playerRank} מתוך ${totalPlayers}`,
    `ניקוד: ${totalScore}`,
    ``,
    `בואו לשחק!`,
  ].join("\n");

  const handleShare = useCallback(async () => {
    // Try native Web Share API first (mobile-friendly)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "ארץ עיר — תוצאות",
          text: shareText,
        });
        return;
      } catch {
        // User cancelled or API unavailable — fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  }, [shareText]);

  return (
    <Button
      variant="secondary"
      size="lg"
      onClick={handleShare}
      className="text-lg font-display"
    >
      <span aria-hidden="true">{copied ? "✅" : "📤"}</span>
      {copied ? "הועתק!" : "שתף תוצאות"}
    </Button>
  );
}
