"use client";

import { Button } from "@/components/ui/Button";

interface DoneButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function DoneButton({ onClick, disabled = false, loading = false }: DoneButtonProps) {
  return (
    <Button
      variant="primary"
      size="lg"
      fullWidth
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      className="text-xl shadow-lg shadow-accent/30 hover:shadow-accent/50"
    >
      <span aria-hidden="true">✅</span>
      סיימתי!
    </Button>
  );
}
