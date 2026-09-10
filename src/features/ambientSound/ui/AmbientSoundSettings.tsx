"use client";

import { useAmbientSoundStore } from "@/features/ambientSound/model/useAmbientSoundStore";
import { Button } from "@/shared/ui/button";
import { Volume2, VolumeX } from "lucide-react";

import { useState } from "react";

/**
 * 설정 Dialog 안에 들어가는 "환경음 > 모닥불" 섹션 UI.
 *
 * - Dialog shell/open 상태/trigger는 알지 않는다. 섹션 heading과 모닥불 row만 렌더한다.
 * - store 상태만 갱신한다. 실제 오디오 반영은 useAmbientSoundStore → TownScene pull이 담당한다.
 *
 * 상태 구분(중요): `volume === 0`(Slider로 볼륨을 0으로 둔 것)과 `isMuted === true`(음소거 버튼)는
 * 완전히 다른 상태다. UI 로직에서 절대 같게 취급하지 않는다.
 * - Slider onChange는 오직 setVolume만 호출한다. isMuted는 건드리지 않는다.
 * - 소리 버튼은 "소리 끄기 / 켜기" 동작이며 상태에 따라 toggleMute 또는 setVolume을 호출한다.
 *
 * displayPercent (UI 표시 전용 볼륨):
 * - persist하지 않고 오디오로도 전달하지 않는다. Slider 위치와 % 텍스트에만 쓴다.
 * - unmute 상태에서는 저장된 volume을 따른다(hydration 등 외부 변경 포함).
 * - mute 진입 순간 0으로 내려가고, unmute 시 저장된 volume으로 복원된다.
 *
 * mute 상태에서 Slider 조작(handleSliderChange):
 * - 1% 이상으로 올리면 "소리를 켜는" 동작으로 보고 volume 저장 + 음소거 해제한다.
 *   (화면에 볼륨이 표시되는데 소리가 안 나는 상태를 만들지 않는다.)
 * - 0%로 두는 것은 음소거 상태를 유지한다.
 */
// 소리 버튼으로 "소리를 다시 켤 때" 저장 volume이 0이면 사용할 기본 복원값.
const RESTORE_VOLUME = 1;

export function AmbientSoundSettings() {
  const volume = useAmbientSoundStore((state) => state.volume);
  const isMuted = useAmbientSoundStore((state) => state.isMuted);
  const setVolume = useAmbientSoundStore((state) => state.setVolume);
  const toggleMute = useAmbientSoundStore((state) => state.toggleMute);

  const storedPercent = Math.round(volume * 100);

  const [displayPercent, setDisplayPercent] = useState(() => (isMuted ? 0 : storedPercent));

  // isMuted / 저장 volume 변화에 맞춰 표시값을 조정한다.
  // (effect 대신 렌더 중 조정 — https://react.dev/learn/you-might-not-need-an-effect)
  const [prevMuted, setPrevMuted] = useState(isMuted);
  const [prevStoredPercent, setPrevStoredPercent] = useState(storedPercent);
  if (isMuted !== prevMuted || storedPercent !== prevStoredPercent) {
    setPrevMuted(isMuted);
    setPrevStoredPercent(storedPercent);
    if (isMuted && !prevMuted) {
      // mute 진입: 저장된 volume은 그대로 두고 표시만 0으로 내린다.
      setDisplayPercent(0);
    } else if (!isMuted) {
      // unmute 전환 + unmute 상태에서의 외부 volume 변경(직접 Slider 0, hydration 등)을 함께 반영한다.
      setDisplayPercent(storedPercent);
    }
    // mute 유지 중 저장 volume 변경(= mute 상태 Slider 조작): displayPercent는 onChange가 이미 갱신함.
  }

  /**
   * 소리 버튼. 아이콘/aria와 무관하게 "소리 끄기 / 켜기" 동작이다.
   * - muted: 음소거를 해제한다. 저장 volume이 0이면 들리도록 기본값으로 복원한다.
   * - unmuted & volume === 0: 음소거가 아니라 볼륨이 0인 상태이므로 볼륨을 복원한다.
   * - unmuted & volume > 0: 음소거한다.
   */
  const handleAudioButton = () => {
    if (isMuted) {
      if (volume === 0) setVolume(RESTORE_VOLUME);
      toggleMute();
      return;
    }

    if (volume === 0) {
      setVolume(RESTORE_VOLUME);
      return;
    }

    toggleMute();
  };

  const handleSliderChange = (next: number) => {
    setDisplayPercent(next);
    setVolume(next / 100);
    // 음소거 중 볼륨을 1% 이상으로 올리면 소리를 켜는 동작으로 본다. 0%는 음소거 유지.
    if (isMuted && next > 0) {
      toggleMute();
    }
  };

  const showSilentIcon = isMuted || volume === 0;

  // 아이콘/라벨은 "무음처럼 보이는지"가 아니라 버튼이 할 동작에 맞춘다.
  const buttonLabel = isMuted
    ? "모닥불 소리 음소거 해제"
    : volume === 0
      ? "모닥불 소리 켜기"
      : "모닥불 소리 음소거";

  return (
    <section aria-labelledby="ambient-sound-heading" className="flex flex-col gap-3">
      <h3 id="ambient-sound-heading" className="text-sm font-semibold">
        환경음
      </h3>

      <div role="group" aria-label="모닥불 소리" className="flex items-center gap-3">
        <span className="w-12 shrink-0 text-sm">모닥불</span>

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
          aria-label="모닥불 소리 볼륨"
          className="accent-primary focus-visible:ring-ring h-1 flex-1 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        />

        <span
          className="text-muted-foreground w-9 shrink-0 text-right text-xs tabular-nums"
          aria-hidden
        >
          {displayPercent}%
        </span>
      </div>
    </section>
  );
}
