"use client";

import { Button } from "@/shared/ui/button";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

interface VoiceControlGroupProps {
  isSpeaker: boolean;
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
  canToggleAudio,
  toggleLocalAudio,
  audioEnabled,
  isAudioToggling,
  listeningVolume,
  lastAudibleListeningVolume,
  setListeningVolume,
}: VoiceControlGroupProps) {
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
    <div className="flex min-w-0 items-center gap-2">
      {isSpeaker ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={audioEnabled ? "마이크 끄기" : "마이크 켜기"}
          aria-pressed={audioEnabled}
          disabled={isAudioButtonDisabled}
          onClick={handleToggleAudio}
          title={audioEnabled ? "방송 중 · 마이크 끄기" : "마이크 켜기"}
          className="h-9 w-10 cursor-pointer gap-1.5 rounded-md border border-gray-200 px-3 text-sm font-normal text-gray-700 hover:bg-gray-50 active:opacity-90 disabled:pointer-events-auto disabled:cursor-not-allowed has-[>svg]:px-3 lg:w-auto"
        >
          {audioEnabled ? (
            <Mic className="size-4" aria-hidden />
          ) : (
            <MicOff className="size-4" aria-hidden />
          )}
          <span className="hidden lg:inline">{audioEnabled ? "방송 중" : "마이크 켜기"}</span>
        </Button>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            aria-label={isPlaybackMuted ? "방송 음량 켜기" : "방송 음량 끄기"}
            aria-pressed={!isPlaybackMuted}
            onClick={handleTogglePlaybackMute}
            className="h-9 shrink-0 gap-1.5 rounded-md px-3 text-gray-600 hover:bg-gray-100 active:opacity-90"
          >
            {isPlaybackMuted ? (
              <VolumeX className="size-4" aria-hidden="true" />
            ) : (
              <Volume2 className="size-4" aria-hidden="true" />
            )}
          </Button>
          <div className="relative h-9 w-35 min-w-6">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-gray-200"
            >
              <span
                className="block h-full rounded-full bg-gray-600"
                style={{ width: `${Math.round(listeningVolume * 100)}%` }}
              />
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(listeningVolume * 100)}
              aria-label="방송 음량"
              onChange={(event) => setListeningVolume(Number(event.currentTarget.value) / 100)}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-blue-500 [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-gray-500 [&::-moz-range-track]:h-1 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gray-500"
            />
          </div>
          <output className="w-10 shrink-0 text-right text-[13px] font-normal text-gray-500 tabular-nums">
            {Math.round(listeningVolume * 100)}%
          </output>
        </div>
      )}
    </div>
  );
}
