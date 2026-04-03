import type { Metadata } from "next";
import { PlayerDashboard } from "@/components/home/PlayerDashboard";

export const metadata: Metadata = {
  title: "דף הבית",
};

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <PlayerDashboard />
    </main>
  );
}
