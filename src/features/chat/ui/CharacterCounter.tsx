import { cn } from "@/lib/utils";

interface CharacterCounterProps {
  current: number;
  max: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
  isInputShaking?: boolean;
}

export function CharacterCounter({
  current,
  max,
  isNearLimit,
  isAtLimit,
  isInputShaking,
}: CharacterCounterProps) {
  if (!isNearLimit) return null;

  return (
    <div
      className={cn(
        "self-end mr-6 py-0.5 px-2 rounded text-xs transition-all duration-200",
        "select-none",
        isInputShaking && "animate-shake",
      )}
    >
      <mark
        className={cn(
          "bg-transparent transition-colors duration-200",
          isAtLimit
            ? "bg-yellow-300 text-red-600 font-bold"
            : "bg-background/80 backdrop-blur-sm text-amber-600 font-bold",
        )}
      >
        {current} / {max}
      </mark>
    </div>
  );
}
