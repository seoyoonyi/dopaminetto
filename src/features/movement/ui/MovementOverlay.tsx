"use client";

import { VILLAGES } from "@/entities/village";
import { useMovementStore } from "@/features/movement/model/store";

import React from "react";

export const MovementOverlay = () => {
  const position = useMovementStore((state) => state.position);
  const villageId = useMovementStore((state) => state.villageId);

  return (
    <>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 shadow-xl pointer-events-none z-10 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ backgroundColor: VILLAGES[villageId]?.color || "#fff" }}
          />
          <span className="text-white font-bold tracking-tight">{VILLAGES[villageId]?.name}</span>
        </div>
        <div className="w-px h-4 bg-white/20" />
        <div className="text-gray-300 font-mono text-sm">
          {Math.round(position.x)}, {Math.round(position.y)}
        </div>
      </div>

      <div className="absolute bottom-4 right-4 bg-black/50 p-2 rounded text-xs text-white pointer-events-none">
        이동: 방향키 / WASD
      </div>
    </>
  );
};
