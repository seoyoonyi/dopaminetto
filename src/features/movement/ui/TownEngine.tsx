"use client";

import { useMovementSync } from "@/features/movement/hooks/useMovementSync";
import { useRestorePlayerPosition } from "@/features/movement/hooks/useRestorePlayerPosition";
import { useSavePlayerPosition } from "@/features/movement/hooks/useSavePlayerPosition";
import { TownScene } from "@/features/movement/lib/TownScene";
import { GAME_CONFIG } from "@/features/movement/model/config";
import { MovementOverlay } from "@/features/movement/ui/MovementOverlay";
import * as Phaser from "phaser";

import React, { useEffect, useRef } from "react";

/**
 * 마을 엔진 컨테이너 컴포넌트
 * Phaser 게임 인스턴스 생성 및 관리, 위치 복원(isReady) 완료 후 마운트 수행
 */
export const TownEngine = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  /**
   * 위치 복원 완료 여부 조회
   * true가 되기 전까지 엔진 마운트를 보류하여 캐릭터 위치 오류 방지
   */
  const { isReady } = useRestorePlayerPosition();

  /**
   * 위치 복원 완료 후에만 현재 위치 저장 활성화
   */
  useSavePlayerPosition(isReady);

  /**
   * 플레이어 간 위치 및 상태 동기화 훅
   */
  useMovementSync();

  useEffect(() => {
    if (!isReady || !gameContainerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: GAME_CONFIG.WIDTH,
      height: GAME_CONFIG.HEIGHT,
      parent: gameContainerRef.current,
      scene: TownScene,
      backgroundColor: "#222",
      pixelArt: true, // 도트 그래픽 보간(안티앨리어싱) 방지
      roundPixels: true, // 소수점 좌표 렌더링 시 외곽선 뭉개짐(번짐) 방지
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [isReady]);

  return (
    <div
      className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden rounded-lg shadow-2xl border-4 border-gray-800"
      style={{ imageRendering: "pixelated" }}
    >
      <div ref={gameContainerRef} />
      <MovementOverlay />
    </div>
  );
};
