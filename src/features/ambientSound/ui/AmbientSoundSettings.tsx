"use client";

import {
  CHRISTMAS_TREE_DEFAULT_VOLUME,
  useAmbientSoundStore,
} from "@/features/ambientSound/model/useAmbientSoundStore";
import { Button } from "@/shared/ui/button";
import { Volume2, VolumeX } from "lucide-react";

import { useState } from "react";

export function AmbientSoundSettings() {
  const volume = useAmbientSoundStore((state) => state.christmasTreeVolume);
  const isMuted = useAmbientSoundStore((state) => state.isChristmasTreeMuted);
  const setVolume = useAmbientSoundStore((state) => state.setChristmasTreeVolume);
  const toggleMute = useAmbientSoundStore((state) => state.toggleChristmasTreeMute);

  const storedPercent = Math.round(volume * 100);
  const [displayPercent, setDisplayPercent] = useState(() => (isMuted ? 0 : storedPercent));
  const [prevMuted, setPrevMuted] = useState(isMuted);
  const [prevStoredPercent, setPrevStoredPercent] = useState(storedPercent);

  if (isMuted !== prevMuted || storedPercent !== prevStoredPercent) {
    setPrevMuted(isMuted);
    setPrevStoredPercent(storedPercent);
    if (isMuted && !prevMuted) {
      setDisplayPercent(0);
    } else if (!isMuted) {
      setDisplayPercent(storedPercent);
    }
  }

  const handleAudioButton = () => {
    if (isMuted) {
      if (volume === 0) setVolume(CHRISTMAS_TREE_DEFAULT_VOLUME);
      toggleMute();
      return;
    }

    if (volume === 0) {
      setVolume(CHRISTMAS_TREE_DEFAULT_VOLUME);
      return;
    }

    toggleMute();
  };

  const handleSliderChange = (next: number) => {
    setDisplayPercent(next);
    setVolume(next / 100);
    if (isMuted && next > 0) toggleMute();
  };

  const showSilentIcon = isMuted || volume === 0;
  const buttonLabel = isMuted
    ? "크리스마스 캐롤 음소거 해제"
    : volume === 0
      ? "크리스마스 캐롤 켜기"
      : "크리스마스 캐롤 음소거";

  return (
    <section aria-labelledby="ambient-sound-heading" className="flex flex-col gap-3">
      <h3 id="ambient-sound-heading" className="text-sm font-semibold">
        환경음
      </h3>

      <div role="group" aria-label="크리스마스 캐롤" className="flex items-center gap-3">
        <span className="w-28 shrink-0 whitespace-nowrap text-sm">크리스마스 캐롤</span>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="shrink-0"
          aria-pressed={isMuted}
          aria-label={buttonLabel}
          onClick={handleAudioButton}
        >
          {showSilentIcon ? (
            <VolumeX className="size-4" aria-hidden />
          ) : (
            <Volume2 className="size-4" aria-hidden />
          )}
        </Button>

        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={displayPercent}
          onChange={(event) => handleSliderChange(Number(event.target.value))}
          aria-label="크리스마스 캐롤 볼륨"
          className="accent-primary focus-visible:ring-ring h-1 flex-1 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        />

        <span
          className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums"
          aria-hidden
        >
          {displayPercent}%
        </span>
      </div>

      <div className="text-muted-foreground space-y-1 border-t pt-3 text-xs leading-relaxed">
        <p>We Wish You A Merry Christmas · 한국저작권위원회 · CC BY</p>
        <p>
          현재 파일: 3:19 MP3, 128 kbps / 48 kHz · 원문: 30:07 · 편집 구간·변환 이력 미확인 ·{" "}
          <a
            href="https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?wrtSn=13238027&menuNo=200020"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            공유마당 출처
          </a>
          {" · "}
          <a
            href="/assets/audio/ambient/ATTRIBUTION.md"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            변경 정보
          </a>
        </p>
      </div>
    </section>
  );
}
