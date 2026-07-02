"use client";

import { MapLoader, TOWN_MAP_TMJ_URL } from "@/entities/village";
import { useMovementStore } from "@/features/movement/model/useMovementStore";

import { useCallback, useEffect, useState } from "react";

type MapLoadStatus = "loading" | "ready" | "error";

export function useTownMapLoader() {
  const mapLoader = useMovementStore((state) => state.mapLoader);
  const setMapLoader = useMovementStore((state) => state.setMapLoader);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (mapLoader) return;

    let isCancelled = false;

    void MapLoader.load(TOWN_MAP_TMJ_URL)
      .then((loader) => {
        if (isCancelled) return;
        setMapLoader(loader);
        setError(null);
      })
      .catch((error) => {
        if (isCancelled) return;

        const normalizedError = error instanceof Error ? error : new Error(String(error));
        console.error("[useTownMapLoader] TMJ 로드 실패:", normalizedError);
        setError(normalizedError);
      });

    return () => {
      isCancelled = true;
    };
  }, [mapLoader, retryCount, setMapLoader]);

  const retry = useCallback(() => {
    setError(null);
    setRetryCount((count) => count + 1);
  }, []);

  const status: MapLoadStatus = error ? "error" : mapLoader ? "ready" : "loading";

  return {
    mapLoader,
    isReady: Boolean(mapLoader) && status === "ready",
    status,
    error,
    retry,
  };
}
