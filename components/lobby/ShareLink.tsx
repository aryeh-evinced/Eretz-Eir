'use client';

import { Button } from '@/components/ui/Button';

interface ShareLinkProps {
  code: string;
}

export function ShareLink({ code }: ShareLinkProps) {
  const handleShare = async () => {
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/join/${code}`
        : '';

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ארץ עיר - הצטרף למשחק!',
          text: `הצטרף למשחק ארץ עיר! קוד חדר: ${code}`,
          url: shareUrl,
        });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
  };

  return (
    <Button onClick={handleShare} variant="secondary" fullWidth>
      שתף קישור
    </Button>
  );
}
