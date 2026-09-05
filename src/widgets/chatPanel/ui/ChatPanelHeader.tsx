"use client";

import { cn } from "@/lib/utils";

interface ChatPanelHeaderProps {
  villageName: string;
  isConnected: boolean;
}

export function ChatPanelHeader({ villageName, isConnected }: ChatPanelHeaderProps) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <span
        className={cn(
          "size-2 rounded-full shrink-0",
          isConnected ? "bg-green-500" : "bg-yellow-400",
        )}
      />
      <span className="font-display text-sm font-medium truncate">{villageName} 채널</span>
      {!isConnected && (
        <span className="font-display text-xs text-muted-foreground shrink-0">연결 중...</span>
      )}
    </div>
  );
}
