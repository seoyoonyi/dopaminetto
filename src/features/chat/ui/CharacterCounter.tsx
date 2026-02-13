import { cn } from "@/lib/utils";

interface CharacterCounterProps {
  current: number;
  max: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
}

export function CharacterCounter({ current, max, isNearLimit, isAtLimit }: CharacterCounterProps) {
  if (!isNearLimit) return null;

  return (
    <div
      className={cn(
        "self-end mr-6 py-0.5 rounded text-xs transition-all duration-200",
        "bg-background/80 backdrop-blur-sm select-none",
        isAtLimit ? "text-red-500 font-medium" : "text-amber-500 font-medium",
      )}
    >
      <span>
        {current} / {max}
      </span>
    </div>
  );
}
