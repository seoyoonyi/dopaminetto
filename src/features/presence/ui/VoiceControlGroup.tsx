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
  /**
   * 음성 역할 상태와 실제 음성 제어 버튼을 한 묶음으로 렌더링한다.
   * speaker와 listener가 같은 레이아웃 안에서 역할 텍스트만 달리 보여주도록 유지한다.
   */
  const roleText = isSpeaker ? "방송자" : "청취자";
  const connectionIndicatorText = voiceConnected ? "연결됨" : "연결 중";
  const isAudioButtonDisabled = !canToggleAudio || !toggleLocalAudio || isAudioToggling;
  const isListeningButtonDisabled = !canToggleListening || !toggleLocalListening;

  const handleToggleAudio = () => {
    if (isAudioButtonDisabled) return;
    void toggleLocalAudio();
  };

  const handleToggleListening = () => {
    if (isListeningButtonDisabled) return;
    void toggleLocalListening();
  };

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

      {isSpeaker ? (
        <Button
          type="button"
          variant={audioEnabled ? "default" : "outline"}
          size="sm"
          aria-label={audioEnabled ? "마이크 끄기" : "마이크 켜기"}
          aria-pressed={audioEnabled}
          disabled={isAudioButtonDisabled}
          onClick={handleToggleAudio}
          className="flex h-10 min-w-[120px] cursor-pointer items-center gap-2 rounded-full px-4 shadow-sm disabled:pointer-events-auto disabled:cursor-not-allowed"
        >
          {audioEnabled ? (
            <Mic className="h-4 w-4" aria-hidden />
          ) : (
            <MicOff className="h-4 w-4" aria-hidden />
          )}
          <span>{audioEnabled ? "방송 중" : "마이크 켜기"}</span>
        </Button>
      ) : (
        <Button
          type="button"
          variant={listeningEnabled ? "default" : "outline"}
          size="sm"
          aria-label={listeningEnabled ? "청취 중지" : "청취 시작"}
          aria-pressed={listeningEnabled}
          disabled={isListeningButtonDisabled}
          onClick={handleToggleListening}
          className="flex h-10 min-w-[120px] cursor-pointer items-center gap-2 rounded-full px-4 shadow-sm disabled:pointer-events-auto disabled:cursor-not-allowed"
        >
          {listeningEnabled ? (
            <Volume2 className="h-4 w-4" aria-hidden />
          ) : (
            <VolumeX className="h-4 w-4" aria-hidden />
          )}
          <span>{listeningEnabled ? "청취 중" : "청취 시작"}</span>
        </Button>
      )}
    </div>
  );
}
