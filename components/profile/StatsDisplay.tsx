import { Card } from "@/components/ui/Card";

interface StatsDisplayProps {
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
}

export function StatsDisplay({ gamesPlayed, gamesWon, totalScore }: StatsDisplayProps) {
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={gamesPlayed} label="משחקים" icon="🎮" color="text-teal" />
        <StatCard value={gamesWon} label="ניצחונות" icon="🏆" color="text-gold" />
        <StatCard value={totalScore} label="ניקוד" icon="⭐" color="text-accent" />
      </div>

      {gamesPlayed > 0 && (
        <Card className="flex justify-between items-center px-5 py-3">
          <span className="text-text-dim text-sm">אחוז ניצחון</span>
          <span className="text-gold font-bold font-display text-xl">{winRate}%</span>
        </Card>
      )}
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
    <Card className="flex flex-col items-center gap-1 py-4 px-2">
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <span className={`font-display font-bold text-2xl ${color}`}>{value}</span>
      <span className="text-text-dim text-xs">{label}</span>
    </Card>
  );
}
