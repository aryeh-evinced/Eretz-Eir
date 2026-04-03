"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { usePlayerStore } from "@/stores/playerStore";

const AVATAR_OPTIONS = [
  "🦊", "🐸", "🦁", "🐼", "🦄", "🦋",
  "🐬", "🐙", "🦜", "🐲", "⭐", "🎮",
];

interface ProfileFormProps {
  onSave?: () => void;
}

export function ProfileForm({ onSave }: ProfileFormProps) {
  const { name, avatar, createProfile } = usePlayerStore();
  const [inputName, setInputName] = useState(name || "");
  const [selectedAvatar, setSelectedAvatar] = useState(avatar || AVATAR_OPTIONS[0]);
  const [error, setError] = useState("");

  function handleSave() {
    const trimmed = inputName.trim();
    if (!trimmed) {
      setError("נא להזין שם");
      return;
    }
    if (trimmed.length > 20) {
      setError("שם יכול להכיל עד 20 תווים");
      return;
    }
    createProfile(trimmed, selectedAvatar);
    onSave?.();
  }

  return (
    <div className="flex flex-col gap-6">
      <Input
        label="שם כינוי"
        placeholder="איך קוראים לך?"
        value={inputName}
        onChange={(e) => {
          setInputName(e.target.value);
          setError("");
        }}
        error={error}
        maxLength={20}
        autoComplete="off"
        autoFocus
      />

      <fieldset>
        <legend className="text-sm font-medium text-text-primary mb-3">
          בחר אווטאר
        </legend>
        <div
          role="radiogroup"
          aria-label="בחר אווטאר"
          className="grid grid-cols-6 gap-2"
        >
          {AVATAR_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="radio"
              aria-checked={selectedAvatar === emoji}
              aria-label={emoji}
              onClick={() => setSelectedAvatar(emoji)}
              className={[
                "flex items-center justify-center text-2xl w-11 h-11 rounded-game border",
                "transition-all duration-150",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal focus-visible:outline-offset-2",
                "active:scale-90 motion-reduce:active:scale-100",
                selectedAvatar === emoji
                  ? "border-accent bg-accent/10 shadow-md shadow-accent/20"
                  : "border-border bg-surface-2 hover:border-text-dim hover:bg-surface",
              ].join(" ")}
            >
              {emoji}
            </button>
          ))}
        </div>
      </fieldset>

      <Button variant="primary" size="lg" fullWidth onClick={handleSave}>
        שמור פרופיל
      </Button>
    </div>
  );
}
