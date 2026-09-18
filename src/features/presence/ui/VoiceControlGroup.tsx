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
  listeningVolume: number;
  lastAudibleListeningVolume: number;
  setListeningVolume: (volume: number) => void;
}

export function VoiceControlGroup({
  isSpeaker,
  voiceConnected,
  canToggleAudio,
  toggleLocalAudio,
  audioEnabled,
  isAudioToggling,
  listeningVolume,
  lastAudibleListeningVolume,
  setListeningVolume,
}: VoiceControlGroupProps) {
  /**
   * 음성 역할 상태와 실제 음성 제어 버튼을 한 묶음으로 렌더링한다.
   */
  const roleText = isSpeaker ? "방송자" : "청취자";
  const connectionIndicatorText = voiceConnected ? "연결됨" : "연결 중";
  const isAudioButtonDisabled = !canToggleAudio || !toggleLocalAudio || isAudioToggling;
  const isPlaybackMuted = listeningVolume === 0;

  const handleToggleAudio = () => {
    if (isAudioButtonDisabled) return;
    void toggleLocalAudio();
  };

  const handleTogglePlaybackMute = () => {
    setListeningVolume(isPlaybackMuted ? lastAudibleListeningVolume : 0);
  };

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="hidden shrink-0 min-w-max items-center gap-2 bg-white px-3 py-2 sm:flex">
        <span className="whitespace-nowrap text-sm font-medium text-gray-900">
          현재 역할: {roleText}
        </span>
        <span className="h-3 w-px bg-gray-200" aria-hidden />
        <span
          className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-normal text-gray-500"
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
          className="flex h-10 min-w-30 cursor-pointer items-center gap-2 rounded-full px-4 shadow-sm active:opacity-90 disabled:pointer-events-auto disabled:cursor-not-allowed has-[>svg]:px-4"
        >
          {audioEnabled ? (
            <Mic className="size-4" aria-hidden />
          ) : (
            <MicOff className="size-4" aria-hidden />
          )}
          <span>{audioEnabled ? "방송 중" : "마이크 켜기"}</span>
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={isPlaybackMuted ? "방송 음량 켜기" : "방송 음량 끄기"}
            aria-pressed={!isPlaybackMuted}
            onClick={handleTogglePlaybackMute}
            className="rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            {isPlaybackMuted ? (
              <VolumeX className="size-4" aria-hidden="true" />
            ) : (
              <Volume2 className="size-4" aria-hidden="true" />
            )}
          </Button>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={Math.round(listeningVolume * 100)}
            aria-label="방송 음량"
            onChange={(event) => setListeningVolume(Number(event.currentTarget.value) / 100)}
            className="h-1 w-32 cursor-pointer accent-gray-900 focus-visible:ring-2 focus-visible:ring-blue-500"
          />
          <output className="min-w-9 text-right text-xs text-gray-500">
            {Math.round(listeningVolume * 100)}%
          </output>
        </div>
      )}
    </div>
  );
}
