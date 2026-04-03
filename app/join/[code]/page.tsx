'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = params.code ?? '';

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(`/lobby/${code}`);
      } else {
        setError(data.error?.message ?? 'שגיאה בהצטרפות');
        setJoining(false);
      }
    } catch {
      setError('שגיאה בהתחברות לשרת');
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-8 text-center">
        <h1 className="text-2xl font-bold text-text-primary font-display mb-2">
          ארץ עיר
        </h1>
        <p className="text-text-dim mb-6">הוזמנת למשחק!</p>
        <div className="bg-input-bg rounded-game px-6 py-3 mb-6">
          <p className="text-sm text-text-dim">קוד חדר</p>
          <p className="text-3xl font-bold text-gold font-display tracking-[0.2em]">
            {code}
          </p>
        </div>

        <Button
          onClick={handleJoin}
          loading={joining}
          size="lg"
          fullWidth
        >
          הצטרף למשחק
        </Button>

        {error && <p className="text-accent text-sm mt-4">{error}</p>}
      </Card>
    </div>
  );
}
