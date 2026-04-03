"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default function NewProfilePage() {
  const router = useRouter();

  function handleSave() {
    router.push("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <Card
        variant="elevated"
        className="w-full max-w-md p-8"
      >
        <header className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl text-text-primary mb-2">
            יצירת פרופיל
          </h1>
          <p className="text-text-dim text-sm">
            בחר שם וסמל כדי להתחיל לשחק
          </p>
        </header>

        <ProfileForm onSave={handleSave} />
      </Card>
    </main>
  );
}
