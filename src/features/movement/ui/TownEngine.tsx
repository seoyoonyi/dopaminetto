"use client";

import { TownScene } from "@/features/movement/lib/TownScene";
import * as Phaser from "phaser";

import React, { useEffect, useRef } from "react";

import { MovementOverlay } from "./MovementOverlay";

/**
 * 마을 엔진 컨테이너: Phaser 게임 인스턴스를 생성하고 관리합니다.
 */
export const TownEngine = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameContainerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
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
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden rounded-lg shadow-2xl border-4 border-gray-800">
      <div ref={gameContainerRef} />
      <MovementOverlay />
    </div>
  );
};
