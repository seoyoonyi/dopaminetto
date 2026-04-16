"use client";

import { Button } from "@/shared/ui/button";
import { Mic, MicOff, Users, Volume2, VolumeX } from "lucide-react";

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

  const canToggleAudio = useTownPresenceStore((state) => state.canToggleAudio);
  const toggleLocalAudio = useTownPresenceStore((state) => state.toggleLocalAudio);
  const audioEnabled = useTownPresenceStore((state) => state.audioEnabled);
  const isAudioToggling = useTownPresenceStore((state) => state.isAudioToggling);

  const canToggleListening = useTownPresenceStore((state) => state.canToggleListening);
  const toggleLocalListening = useTownPresenceStore((state) => state.toggleLocalListening);
  const listeningEnabled = useTownPresenceStore((state) => state.listeningEnabled);

  const toggleLabel = isUsersPanel ? "채팅 패널로 보기" : "사용자 패널로 보기";
  const toggleText = isUsersPanel ? "채팅" : "사용자";
  const connectionIndicatorClass = `h-2 w-2 rounded-full ${
    isConnected ? "bg-emerald-500" : "bg-red-500"
  }`;
  const connectionIndicatorText = isConnected ? "연결됨" : "연결 끊김";

  const handleToggleAudio = () => {
    if (!canToggleAudio || !toggleLocalAudio || isAudioToggling) return;
    void toggleLocalAudio();
  };

  const handleToggleListening = () => {
    if (!canToggleListening || !toggleLocalListening) return;
    void toggleLocalListening();
  };

  return (
    <div className="flex items-center justify-end gap-2">
      {canToggleAudio ? (
        <Button
          type="button"
          variant={audioEnabled ? "default" : "outline"}
          size="sm"
          aria-label={audioEnabled ? "마이크 끄기" : "마이크 켜기"}
          aria-pressed={audioEnabled}
          disabled={!toggleLocalAudio || isAudioToggling}
          onClick={handleToggleAudio}
          className="flex h-10 min-w-[120px] items-center gap-2 rounded-full px-4 shadow-sm"
        >
          {audioEnabled ? (
            <Mic className="h-4 w-4" aria-hidden />
          ) : (
            <MicOff className="h-4 w-4" aria-hidden />
          )}
          <span>{audioEnabled ? "방송 중" : "마이크 켜기"}</span>
        </Button>
      ) : null}

      {canToggleListening ? (
        <Button
          type="button"
          variant={listeningEnabled ? "default" : "outline"}
          size="sm"
          aria-label={listeningEnabled ? "청취 중지" : "청취 시작"}
          aria-pressed={listeningEnabled}
          disabled={!toggleLocalListening}
          onClick={handleToggleListening}
          className="flex h-10 min-w-[120px] items-center gap-2 rounded-full px-4 shadow-sm"
        >
          {listeningEnabled ? (
            <Volume2 className="h-4 w-4" aria-hidden />
          ) : (
            <VolumeX className="h-4 w-4" aria-hidden />
          )}
          <span>{listeningEnabled ? "청취 중" : "청취 시작"}</span>
        </Button>
      ) : null}

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
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" aria-hidden />
          <span>{participantCount}</span>
          <span className="hidden sm:inline">{toggleText}</span>
        </div>

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
    </div>
  );
};
