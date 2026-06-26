"use client";

import { LOBBY_VILLAGE_ID, VillageId } from "@/entities/village";
import { fetchPlayerPosition } from "@/features/movement/lib/playerPositionService";
import { isValidSavedPosition } from "@/features/movement/lib/validateMovement";
import type { RestoreStatus } from "@/features/movement/model/types";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useUserInfo } from "@/shared/hooks/useUserInfo";

import { useEffect, useState } from "react";

interface RestorePlayerPositionState {
  isReady: boolean;
  restoreStatus: RestoreStatus;
}

/**
 * 접속 시 Supabase user_position 테이블에서 마지막 저장 위치를 조회하고,
 * 유효하면 스토어에 초기 위치로 적용한다.
 *
 * isReady가 true가 되기 전까지 엔진 마운트를 보류해
 * 기본 위치에 잠깐 나타났다가 저장 위치로 이동하는 텔레포트 현상을 방지한다.
 */
export function useRestorePlayerPosition() {
  const [restoreState, setRestoreState] = useState<RestorePlayerPositionState>({
    isReady: false,
    restoreStatus: "loading",
  });
  const { data: user, isLoading: isUserLoading } = useUserInfo();
  const initializePosition = useMovementStore((state) => state.initializePosition);
  const mapLoader = useMovementStore((state) => state.mapLoader);

  useEffect(() => {
    // 유저 정보 로딩 중에는 대기
    if (isUserLoading || !mapLoader) return;

    let isCancelled = false;

    // async IIFE로 감싸 setState가 마이크로태스크에서 호출되도록 한다.
    // (useEffect 내 동기 setState는 불필요한 렌더 연쇄를 유발할 수 있다)
    void (async () => {
      /**
       * 저장 위치가 없거나 복원할 수 없을 때는 useMovementStore의 현재 초기 위치를
       * 안전 스폰 보정 경로로 확정해 기존 randomized fallback을 유지한다.
       */
      const initializeDefaultSpawn = () => {
        if (isCancelled) return;

        const spawnPoint = mapLoader.getSpawnPoint(LOBBY_VILLAGE_ID);
        const fallbackPosition = spawnPoint ?? useMovementStore.getState().position;
        initializePosition(fallbackPosition, LOBBY_VILLAGE_ID);
      };

      try {
        if (user) {
          const saved = await fetchPlayerPosition(user.id);

          if (isCancelled) return;

          if (
            saved &&
            isValidSavedPosition(saved.village_id, { x: saved.x, y: saved.y }, mapLoader)
          ) {
            // 유효한 저장 위치가 있으면 스토어에 반영
            initializePosition({ x: saved.x, y: saved.y }, saved.village_id as VillageId);
            setRestoreState({ isReady: true, restoreStatus: "restored" });
          } else {
            // 저장 위치가 없거나 유효하지 않으면 기본 스폰 위치도 안전 보정 경로를 거친다.
            initializeDefaultSpawn();
            setRestoreState({ isReady: true, restoreStatus: "fallback" });
          }
        } else {
          initializeDefaultSpawn();
          setRestoreState({ isReady: true, restoreStatus: "fallback" });
        }
      } catch (err) {
        if (isCancelled) return;

        // 조회 실패 시 기본 위치로 진입, 실패는 로깅
        initializeDefaultSpawn();
        setRestoreState({ isReady: true, restoreStatus: "fallback" });
        console.error("[useRestorePlayerPosition] 위치 조회 실패:", err);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [user, isUserLoading, initializePosition, mapLoader]);

  return restoreState;
}
