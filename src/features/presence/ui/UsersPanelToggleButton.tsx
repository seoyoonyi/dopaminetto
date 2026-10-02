"use client";

import { Button } from "@/shared/ui/button";
import { MessageCircle, Users } from "lucide-react";

interface UsersPanelToggleButtonProps {
  participantCount: number;
  isUsersPanel?: boolean;
  onToggle?: () => void;
}

export function UsersPanelToggleButton({
  participantCount,
  isUsersPanel = false,
  onToggle,
}: UsersPanelToggleButtonProps) {
  const toggleLabel = isUsersPanel ? "채팅 패널로 보기" : "사용자 패널로 보기";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={`${toggleLabel}, ${participantCount}명`}
      title={`${toggleLabel} · ${participantCount}명`}
      onClick={onToggle}
      className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-normal whitespace-nowrap text-gray-700 hover:bg-gray-100 active:opacity-90 has-[>svg]:px-3"
    >
      {isUsersPanel ? (
        <MessageCircle className="size-4" aria-hidden />
      ) : (
        <Users className="size-4" aria-hidden />
      )}
      <span>{isUsersPanel ? "채팅" : `${participantCount} 사용자`}</span>
    </Button>
  );
}
