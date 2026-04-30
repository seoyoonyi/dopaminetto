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
 * 마을 엔진 컨테이너: Phaser 게임 인스턴스를 생성하고 관리한다.
 *
 * 마지막 저장 위치 조회(isReady)가 완료되기 전까지 Phaser 마운트를 보류해
 * 기본 위치에 잠깐 나타났다가 저장 위치로 이동하는 텔레포트 현상을 방지한다.
 */
export const TownEngine = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  // 위치 복원 완료 여부 - true가 되기 전까지 엔진 마운트 보류
  const { isReady } = useRestorePlayerPosition();
  // 위치 복원 완료 후에만 저장 활성화 (복원 전 기본 위치가 저장되는 것을 방지)
  useSavePlayerPosition(isReady);
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
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden rounded-lg shadow-2xl border-4 border-gray-800">
      <div ref={gameContainerRef} />
      <MovementOverlay />
    </div>
  );
};
