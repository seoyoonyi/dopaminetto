"use client";

import { Button } from "@/shared/ui/button";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

interface VoiceControlGroupProps {
  isSpeaker: boolean;
  voiceConnected: boolean;
  canToggleAudio: boolean;
  toggleLocalAudio: (() => Promise<void>) | null;
  audioEnabled: boolean;
  isAudioToggling: boolean;
  canToggleListening: boolean;
  toggleLocalListening: (() => Promise<void>) | null;
  listeningEnabled: boolean;
}

export function VoiceControlGroup({
  isSpeaker,
  voiceConnected,
  canToggleAudio,
  toggleLocalAudio,
  audioEnabled,
  isAudioToggling,
  canToggleListening,
  toggleLocalListening,
  listeningEnabled,
}: VoiceControlGroupProps) {
  const roleText = isSpeaker ? "방송자" : "청취자";
  const connectionIndicatorText = voiceConnected ? "연결됨" : "연결 중";

  const handleToggleAudio = () => {
    if (!canToggleAudio || !toggleLocalAudio || isAudioToggling) return;
    void toggleLocalAudio();
  };

  const handleToggleListening = () => {
    if (!canToggleListening || !toggleLocalListening) return;
    void toggleLocalListening();
  };

  if (!canToggleAudio && !canToggleListening) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex items-center gap-2 bg-white px-3 py-2">
        <span className="text-sm font-medium text-gray-900">현재 역할: {roleText}</span>
        <span className="h-3 w-px bg-gray-200" aria-hidden />
        <span
          className="flex items-center gap-1 text-xs font-normal text-gray-500"
          aria-live="polite"
        >
          <span>음성 연결 상태: {connectionIndicatorText}</span>
        </span>
      </div>

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
    </div>
  );
}
