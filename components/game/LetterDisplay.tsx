"use client";

interface LetterDisplayProps {
  letter: string;
  animated?: boolean;
}

export function LetterDisplay({ letter, animated = false }: LetterDisplayProps) {
  return (
    <div className="flex items-center justify-center" aria-label={`האות ${letter}`}>
      <span
        className={[
          "font-display font-bold text-8xl md:text-9xl leading-none select-none",
          "text-accent drop-shadow-[0_0_24px_rgba(233,69,96,0.5)]",
          animated
            ? "animate-[letterIn_0.5s_ease-out] motion-reduce:animate-none"
            : "",
        ].join(" ")}
      >
        {letter}
      </span>

      <style jsx>{`
        @keyframes letterIn {
          0% {
            opacity: 0;
            transform: scale(0.3) rotate(-12deg);
          }
          60% {
            opacity: 1;
            transform: scale(1.1) rotate(2deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
          }
        }
      `}</style>
    </div>
  );
}
