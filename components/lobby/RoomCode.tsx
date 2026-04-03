'use client';

import { useState } from 'react';

interface RoomCodeProps {
  code: string;
}

export function RoomCode({ code }: RoomCodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: ignored — user can copy manually
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-text-dim">קוד חדר</p>
      <button
        onClick={handleCopy}
        className={[
          'bg-surface-2 border-2 rounded-game px-8 py-4',
          'text-4xl font-bold tracking-[0.3em] text-gold font-display',
          'transition-colors cursor-pointer active:scale-95',
          copied ? 'border-teal' : 'border-accent hover:border-gold',
        ].join(' ')}
        title="לחץ להעתקה"
      >
        {code}
      </button>
      <p className="text-xs text-text-dim">
        {copied ? 'הועתק!' : 'לחץ להעתקה'}
      </p>
    </div>
  );
}
