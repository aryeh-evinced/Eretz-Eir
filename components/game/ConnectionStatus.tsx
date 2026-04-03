'use client';

import { useState, useEffect } from 'react';

interface ConnectionStatusProps {
  /** Whether the realtime channel is currently connected. */
  connected: boolean;
  /** Transient announcement text (e.g. "host changed to X"). */
  announcement?: string;
}

/**
 * Fixed banner showing reconnection status + an aria-live region for
 * screen-reader announcements (host transfers, player disconnects, etc.).
 */
export function ConnectionStatus({ connected, announcement }: ConnectionStatusProps) {
  const [show, setShow] = useState(false);
  const [lastAnnouncement, setLastAnnouncement] = useState('');

  useEffect(() => {
    if (!connected) {
      setShow(true);
    } else {
      // Brief delay so user sees the "reconnected" confirmation
      const timer = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [connected]);

  useEffect(() => {
    if (announcement) {
      setLastAnnouncement(announcement);
      const timer = setTimeout(() => setLastAnnouncement(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [announcement]);

  return (
    <>
      {show && (
        <div
          role="status"
          className={`fixed top-0 inset-x-0 z-50 px-4 py-2 text-center text-sm font-medium transition-colors ${
            connected
              ? 'bg-emerald-600 text-white'
              : 'bg-amber-500 text-black animate-pulse'
          }`}
        >
          {connected ? '✓ מחובר מחדש' : '⚡ מתחבר מחדש...'}
        </div>
      )}
      {/* Screen-reader-only live region for game events */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {lastAnnouncement}
      </div>
    </>
  );
}
