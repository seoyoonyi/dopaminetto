"use client";

import { Button } from "@/shared/ui/button";

import { useTownPresence } from "../model/useTownPresence";

interface PresenceToolbarButtonProps {
  onToggle?: () => void;
}

export const PresenceToolbarButton = ({ onToggle }: PresenceToolbarButtonProps) => {
  const { participants, isConnected } = useTownPresence();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onToggle}
      className="rounded-full px-4 text-sm text-gray-700"
      aria-label={`현재 접속자 ${participants.length}명, ${isConnected ? "연결됨" : "대기 중"}`}
    >
      <span className="font-medium">사용자</span>
      <span className="text-gray-500">{participants.length}명</span>
      <span className={isConnected ? "text-green-600" : "text-red-500"}>
        {isConnected ? "● 연결" : "● 대기"}
      </span>
    </Button>
  );
};
