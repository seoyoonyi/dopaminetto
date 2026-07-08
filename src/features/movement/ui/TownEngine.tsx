"use client";

import { useMovementSync } from "@/features/movement/hooks/useMovementSync";
import { useRestorePlayerPosition } from "@/features/movement/hooks/useRestorePlayerPosition";
import { useSavePlayerPosition } from "@/features/movement/hooks/useSavePlayerPosition";
import { useTownMapLoader } from "@/features/movement/hooks/useTownMapLoader";
import { TownScene } from "@/features/movement/lib/TownScene";
import { GAME_CONFIG } from "@/features/movement/model/config";
import {
  FALLBACK_SPAWN_STABILIZE_MS,
  resolveTownEntryGate,
} from "@/features/movement/model/entryGate";
import type { RestoreStatus } from "@/features/movement/model/types";
import { MovementOverlay } from "@/features/movement/ui/MovementOverlay";
import { TownEntryPreparing } from "@/features/movement/ui/TownEntryPreparing";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import * as Phaser from "phaser";

import React, { useEffect, useRef, useState } from "react";

/**
 * Phaser 게임 엔진을 React 환경에 마운트하고 관리하는 엔진 컨테이너
 * 위치 복원 상태와 연동하여 게임 인스턴스의 초기화 타이밍을 제어함
 */

/**
 * 마을 엔진 컨테이너 컴포넌트
 * Phaser 게임 인스턴스 생성 및 관리, 위치 복원(isReady) 완료 후 마운트 수행
 */
export const TownEngine = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [fallbackWaitElapsed, setFallbackWaitElapsed] = useState(false);
  const [engineVisible, setEngineVisible] = useState(false);
  const [previousRestoreStatus, setPreviousRestoreStatus] = useState<RestoreStatus>("loading");

  /**
   * Tiled TMJ 맵 로드 완료 후 위치 복원/엔진 마운트를 진행한다.
   */
  const {
    isReady: isMapReady,
    status: mapLoadStatus,
    error: mapLoadError,
    retry: retryMapLoad,
  } = useTownMapLoader();

  /**
   * 위치 복원 완료 여부 조회
   * true가 되기 전까지 엔진 마운트를 보류하여 캐릭터 위치 오류 방지
   */
  const { isReady, restoreStatus } = useRestorePlayerPosition();
  const isTownReady = isMapReady && isReady;

  /**
   * restore 상태가 바뀌면 fallback gate의 파생 상태를 함께 초기화한다.
   * useEffect 내 동기 setState 대신 React 권장 이전 값 비교 패턴을 사용한다.
   */
  if (previousRestoreStatus !== restoreStatus) {
    setPreviousRestoreStatus(restoreStatus);
    setFallbackWaitElapsed(false);
    setEngineVisible(false);
  }

  const entryGate = resolveTownEntryGate({
    isReady: isTownReady,
    restoreStatus,
    fallbackWaitElapsed,
  });
  const mapLoadErrorMessage =
    mapLoadError?.message ?? "마을 지도를 불러오는 중 알 수 없는 오류가 발생했습니다.";

  /**
   * 위치 복원 완료 후에만 현재 위치 저장 활성화
   */
  useSavePlayerPosition(isTownReady);

  /**
   * 플레이어 간 위치 및 상태 동기화 훅
   */
  useMovementSync(isTownReady);

  /**
   * fallback spawn은 realtime presence 반영 전 잠깐 겹쳐 보일 수 있어
   * 엔진을 즉시 표시하지 않고 짧은 준비 상태를 유지한다.
   */
  useEffect(() => {
    if (!isTownReady || restoreStatus !== "fallback" || fallbackWaitElapsed) return;

    const timeout = setTimeout(() => {
      setFallbackWaitElapsed(true);
    }, FALLBACK_SPAWN_STABILIZE_MS);

    return () => clearTimeout(timeout);
  }, [fallbackWaitElapsed, isTownReady, restoreStatus]);

  /**
   * 맵(Phaser 캔버스) 클릭 시 채팅 입력창 포커스 해제
   * Phaser가 캔버스 mousedown에서 preventDefault를 호출해 브라우저의 기본 blur 동작까지
   * 함께 막히므로, 여기서 activeElement를 직접 확인해 명시적으로 blur 처리한다.
   */
  const handleMapPointerDown = () => {
    const activeElement = document.activeElement;
    const isTyping =
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      (activeElement as HTMLElement | null)?.isContentEditable === true;

    if (isTyping) {
      (activeElement as HTMLElement).blur();
    }
  };

  useEffect(() => {
    if (!entryGate.canMountEngine || !gameContainerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: GAME_CONFIG.WIDTH,
      height: GAME_CONFIG.HEIGHT,
      parent: gameContainerRef.current,
      scene: TownScene,
      backgroundColor: "#222",
      pixelArt: true, // 도트 그래픽 보간(안티앨리어싱) 방지
      roundPixels: true, // 소수점 좌표 렌더링 시 외곽선 뭉개짐(번짐) 방지
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    gameRef.current = new Phaser.Game(config);
    const frameId = requestAnimationFrame(() => {
      setEngineVisible(true);
    });

    return () => {
      cancelAnimationFrame(frameId);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [entryGate.canMountEngine]);

  return (
    <div
      className="relative w-full h-full flex items-center justify-center bg-[#c8aa78] overflow-hidden rounded-lg shadow-2xl border-4 border-gray-800"
      style={{ imageRendering: "pixelated" }}
    >
      {mapLoadStatus === "error" ? (
        <TownMapLoadError message={mapLoadErrorMessage} onRetry={retryMapLoad} />
      ) : entryGate.showPreparing ? (
        <TownEntryPreparing />
      ) : null}
      <div
        ref={gameContainerRef}
        onPointerDown={handleMapPointerDown}
        className={cn(
          "h-full w-full",
          !entryGate.canMountEngine && "pointer-events-none opacity-0",
          entryGate.shouldFadeIn && "opacity-0 transition-opacity duration-300",
          entryGate.shouldFadeIn && engineVisible && "opacity-100",
        )}
      />
      {entryGate.canMountEngine ? <MovementOverlay /> : null}
    </div>
  );
};

interface TownMapLoadErrorProps {
  message: string;
  onRetry: () => void;
}

function TownMapLoadError({ message, onRetry }: TownMapLoadErrorProps) {
  return (
    <section
      aria-live="assertive"
      className="absolute inset-0 z-20 flex items-center justify-center bg-[#c8aa78] px-6 text-center text-white"
      role="alert"
    >
      <div className="max-w-sm rounded-lg border border-black/15 bg-black/60 px-6 py-5 shadow-xl backdrop-blur-sm">
        <h2 className="text-base font-semibold">마을 지도를 불러오지 못했습니다.</h2>
        <p className="mt-2 wrap-break-word text-sm leading-6 text-white/80">{message}</p>
        <Button className="mt-4" onClick={onRetry} type="button" variant="secondary">
          다시 시도
        </Button>
      </div>
    </section>
  );
}
