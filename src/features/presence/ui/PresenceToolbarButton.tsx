"use client";

import { Button } from "@/shared/ui/button";
import { Users } from "lucide-react";

import { useTownPresenceStore } from "../model/useTownPresenceStore";

interface PresenceToolbarButtonProps {
  onToggle?: () => void;
  isUsersPanel?: boolean;
}

export const PresenceToolbarButton = ({
  onToggle,
  isUsersPanel = false,
}: PresenceToolbarButtonProps) => {
  const participantCount = useTownPresenceStore((state) => state.participants.length);
  const isConnected = useTownPresenceStore((state) => state.isConnected);
  const toggleLabel = isUsersPanel ? "채팅 패널로 보기" : "사용자 패널로 보기";
  const toggleText = isUsersPanel ? "사용자" : "채팅";
  const connectionIndicatorClass = `h-2 w-2 rounded-full ${
    isConnected ? "bg-emerald-500" : "bg-red-500"
  }`;
  const connectionIndicatorText = isConnected ? "연결됨" : "연결 끊김";

  return (
    <Button
      type="button"
      variant={isUsersPanel ? "default" : "outline"}
      size="sm"
      aria-pressed={isUsersPanel}
      aria-label={toggleLabel}
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
        isUsersPanel ? "bg-gray-900 text-white" : "bg-white text-gray-700"
      }`}
    >
      <Users className="h-4 w-4" aria-hidden />
      <span>{participantCount}</span>
      <span className="hidden sm:inline">{toggleText}</span>
      <span
        className="flex items-center gap-1 text-xs font-normal text-gray-500"
        aria-live="polite"
      >
        <span className={connectionIndicatorClass} aria-hidden />
        <span>{connectionIndicatorText}</span>
      </span>
      <span className="sr-only">{isConnected ? "Presence 연결됨" : "Presence 연결 대기"}</span>
    </Button>
  );
};
