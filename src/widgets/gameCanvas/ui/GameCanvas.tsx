"use client";

import Phaser from "phaser";

import { useEffect, useRef, useState } from "react";

import { IllustrationMapScene } from "../scene/IllustrationMapScene";
import { TileMapScene } from "../scene/TileMapScene";

export default function GameCanvas() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const [currentScene, setCurrentScene] = useState<"tilemap" | "illustration">("illustration");

  useEffect(() => {
    if (!parentRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: parentRef.current,
      width: "100%",
      height: "100%",
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          /**
           * 디버그 모드
           * true: 충돌 영역을 시각적으로 표시 (개발 중 사용)
           * false: 충돌 영역 숨김 (프로덕션)
           */
          debug: false,
        },
      },
      scene: [IllustrationMapScene, TileMapScene],
      /**
       * 배경색 (하늘색)
       * 맵 이미지가 로드되기 전 또는 맵 밖 영역에 표시됨
       */
      backgroundColor: "#87CEEB",
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  const switchScene = () => {
    if (!gameRef.current) return;

    const newScene = currentScene === "tilemap" ? "illustration" : "tilemap";
    const sceneKey = newScene === "tilemap" ? "TileMapScene" : "IllustrationMapScene";

    gameRef.current.scene.keys[
      currentScene === "tilemap" ? "TileMapScene" : "IllustrationMapScene"
    ].scene.stop();

    gameRef.current.scene.keys[sceneKey].scene.start();

    setCurrentScene(newScene);
  };

  return (
    <div className="relative h-full w-full">
      <div ref={parentRef} className="h-full w-full" />

      <button
        onClick={switchScene}
        className="absolute right-4 top-4 z-10 rounded-lg bg-white/90 px-4 py-2 text-sm font-medium text-gray-700 shadow-md transition hover:bg-white"
      >
        {currentScene === "tilemap" ? "일러스트 맵" : "타일 맵"}
      </button>
    </div>
  );
}
