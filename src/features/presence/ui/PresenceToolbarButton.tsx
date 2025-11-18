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
  const toggleText = isUsersPanel ? "채팅" : "사용자";
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
      className={`flex h-10 min-w-[145px] items-center justify-between gap-2 rounded-full px-4 text-sm font-medium transition-colors shadow-sm ${
        isUsersPanel
          ? "border border-gray-900 bg-gray-900 text-white"
          : "border bg-white text-gray-700"
      }`}
    >
      <Users className="h-4 w-4" aria-hidden />
      <span>{participantCount}</span>
      <span className="hidden sm:inline">{toggleText}</span>
      <span
        className={`flex items-center gap-1 text-[11px] font-normal ${
          isUsersPanel ? "text-gray-300" : "text-gray-500"
        }`}
        aria-live="polite"
      >
        <span className={connectionIndicatorClass} aria-hidden />
        <span>{connectionIndicatorText}</span>
      </span>
    </Button>
  );
};
