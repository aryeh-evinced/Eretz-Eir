"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { RecoveryDialog } from "@/components/game/RecoveryDialog";
import { usePlayerStore } from "@/stores/playerStore";
import { CATEGORY_ICONS, STANDARD_CATEGORIES } from "@/lib/constants/categories";

export function PlayerDashboard() {
  const { name, avatar, stats, hasProfile } = usePlayerStore();
  const profileExists = hasProfile();

  return (
    <div className="flex flex-col min-h-screen">
      <RecoveryDialog />

      {/* ─── Header / Hero ─────────────────────────────────────── */}
      <header className="flex flex-col items-center text-center px-6 pt-12 pb-8 gap-3">
        {/* Logo */}
        <div className="relative">
          <h1 className="font-display font-bold text-6xl sm:text-7xl gradient-text select-none leading-tight">
            ארץ עיר
          </h1>
          <div
            className="absolute inset-0 blur-3xl opacity-20 bg-gradient-to-l from-accent via-gold to-teal -z-10"
            aria-hidden="true"
          />
        </div>

        <p className="text-text-dim text-lg font-medium">המשחק הקלאסי — עכשיו דיגיטלי 🎮</p>

        {profileExists ? (
          <div className="flex items-center gap-3 mt-1">
            <Avatar emoji={avatar} name={name} size="sm" />
            <p className="text-text-primary font-medium">
              שלום, <span className="text-gold font-bold">{name}</span>!
            </p>
          </div>
        ) : (
          <p className="text-text-dim text-sm mt-1">צור פרופיל כדי לשמור ניקוד 👤</p>
        )}
      </header>

      {/* ─── Main CTAs ─────────────────────────────────────────── */}
      <section
        aria-label="פעולות ראשיות"
        className="flex flex-col items-center gap-4 px-6 pb-8 w-full max-w-sm mx-auto"
      >
        <Link href="/setup" className="w-full">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="text-xl shadow-xl shadow-accent/30 hover:shadow-accent/50"
          >
            <span aria-hidden="true">🎲</span>
            משחק חדש
          </Button>
        </Link>

        <Link href="/join" className="w-full">
          <Button variant="secondary" size="lg" fullWidth className="text-lg">
            <span aria-hidden="true">🔗</span>
            הצטרף למשחק
          </Button>
        </Link>

        {!profileExists && (
          <Link href="/profile/new" className="w-full">
            <Button
              variant="ghost"
              size="md"
              fullWidth
              className="text-teal hover:text-teal border border-teal/30 hover:border-teal/60"
            >
              <span aria-hidden="true">👤</span>
              צור פרופיל
            </Button>
          </Link>
        )}
      </section>

      {/* ─── Quick Stats ───────────────────────────────────────── */}
      <section
        aria-label="סטטיסטיקות מהירות"
        className="px-6 pb-8 w-full max-w-md mx-auto"
      >
        <h2 className="text-text-dim text-xs font-bold uppercase tracking-widest mb-3 text-center">
          סטטיסטיקות
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard value={stats.gamesPlayed} label="משחקים" icon="🎮" color="text-teal" />
          <StatCard value={stats.gamesWon} label="ניצחונות" icon="🏆" color="text-gold" />
          <StatCard value={stats.totalScore} label="ניקוד" icon="⭐" color="text-accent" />
        </div>
      </section>

      {/* ─── Categories Preview ────────────────────────────────── */}
      <section
        aria-label="קטגוריות המשחק"
        className="px-6 pb-12 w-full max-w-md mx-auto"
      >
        <h2 className="text-text-dim text-xs font-bold uppercase tracking-widest mb-3 text-center">
          קטגוריות
        </h2>
        <div className="flex flex-wrap gap-2 justify-center">
          {STANDARD_CATEGORIES.map((cat) => (
            <Badge key={cat} variant="default" size="lg" icon={CATEGORY_ICONS[cat]}>
              {cat}
            </Badge>
          ))}
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────────────── */}
      <footer className="mt-auto text-center py-6 text-text-dim text-xs">
        ארץ עיר — גרסה דיגיטלית
      </footer>
    </div>
  );
}

function StatCard({
  value,
  label,
  icon,
  color,
}: {
  value: number;
  label: string;
  icon: string;
  color: string;
}) {
  return (
    <Card variant="elevated" className="flex flex-col items-center gap-1 py-4 px-2">
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <span className={`font-display font-bold text-2xl ${color}`}>{value}</span>
      <span className="text-text-dim text-xs">{label}</span>
    </Card>
  );
}
