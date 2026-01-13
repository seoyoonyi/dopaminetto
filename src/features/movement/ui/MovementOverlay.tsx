"use client";

import { VILLAGES } from "@/entities/village";
import { useMovementStore } from "@/features/movement/model/store";
import { useShallow } from "zustand/react/shallow";

import React from "react";

export const MovementOverlay = () => {
  const { position, villageId, isValidating, validationLatency, pendingDelta } = useMovementStore(
    useShallow((state) => ({
      position: state.position,
      villageId: state.villageId,
      isValidating: state.isValidating,
      validationLatency: state.validationLatency,
      pendingDelta: state.pendingDelta,
    })),
  );

  const hasPending = pendingDelta.x !== 0 || pendingDelta.y !== 0;

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

      <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
        <div className="bg-black/50 px-2 py-1 rounded text-[10px] text-gray-400 border border-white/10 flex items-center gap-3">
          <div className="flex items-center gap-1.5 border-r border-white/10 pr-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${isValidating ? "bg-yellow-400 animate-ping" : hasPending ? "bg-blue-400" : "bg-green-400"}`}
            />
            <span className="font-bold uppercase tracking-wider">
              {isValidating ? "Syncing" : hasPending ? "Buffering" : "Stable"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-50">Lat:</span>
            <span className={validationLatency > 15 ? "text-red-400" : "text-green-400"}>
              {validationLatency.toFixed(3)}ms
            </span>
          </div>
        </div>
        <div className="bg-black/50 p-2 rounded text-xs text-white pointer-events-none">
          이동: 방향키 / WASD
        </div>
      </div>
    </>
  );
};
