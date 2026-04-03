"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useGameStore } from "@/stores/gameStore";

export function RecoveryDialog() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const { session, recoverGame, clearGame } = useGameStore();
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (recoverGame()) {
      setIsOpen(true);
    }
    // Only run on mount — session from Zustand persist is already hydrated here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleContinue() {
    setIsOpen(false);
    if (session) {
      router.push(`/game/${session.id}`);
    }
  }

  function handleDiscard() {
    clearGame();
    setIsOpen(false);
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Hidden element that acts as the focus-return target */}
      <button ref={triggerRef} className="sr-only" aria-hidden="true" tabIndex={-1} />
      <Modal
        open={isOpen}
        onClose={handleDiscard}
        title="משחק לא גמור"
        description="נמצא משחק שלא הסתיים. להמשיך?"
        triggerRef={triggerRef}
      >
        <div className="flex flex-col gap-3 mt-2">
          <Button variant="primary" size="lg" fullWidth onClick={handleContinue}>
            <span aria-hidden="true">▶️</span>
            המשך משחק
          </Button>
          <Button variant="secondary" size="md" fullWidth onClick={handleDiscard}>
            התחל מחדש
          </Button>
        </div>
      </Modal>
    </>
  );
}
