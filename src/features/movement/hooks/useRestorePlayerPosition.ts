"use client";

import { VillageId } from "@/entities/village";
import { fetchPlayerPosition } from "@/features/movement/lib/playerPositionService";
import { isValidSavedPosition } from "@/features/movement/lib/validateMovement";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useUserInfo } from "@/shared/hooks/useUserInfo";

import { useEffect, useState } from "react";

/**
 * 접속 시 Supabase user_position 테이블에서 마지막 저장 위치를 조회하고,
 * 유효하면 스토어에 초기 위치로 적용한다.
 *
 * isReady가 true가 되기 전까지 엔진 마운트를 보류해
 * 기본 위치에 잠깐 나타났다가 저장 위치로 이동하는 텔레포트 현상을 방지한다.
 */
export function useRestorePlayerPosition() {
  const [isReady, setIsReady] = useState(false);
  const { data: user, isLoading: isUserLoading } = useUserInfo();
  const initializePosition = useMovementStore((state) => state.initializePosition);

  useEffect(() => {
    // 유저 정보 로딩 중에는 대기
    if (isUserLoading) return;

    // async IIFE로 감싸 setState가 마이크로태스크에서 호출되도록 한다.
    // (useEffect 내 동기 setState는 불필요한 렌더 연쇄를 유발할 수 있다)
    void (async () => {
      try {
        if (user) {
          const saved = await fetchPlayerPosition(user.id);

          if (saved && isValidSavedPosition(saved.village_id, { x: saved.x, y: saved.y })) {
            // 유효한 저장 위치가 있으면 스토어에 반영
            initializePosition({ x: saved.x, y: saved.y }, saved.village_id as VillageId);
          }
          // 저장 위치가 없거나 유효하지 않으면 기본 스폰 위치(로비) 유지
        }
      } catch (err) {
        // 조회 실패 시 기본 위치로 진입, 실패는 로깅
        console.error("[useRestorePlayerPosition] 위치 조회 실패:", err);
      } finally {
        // 성공/실패 모두 엔진 마운트를 허용
        setIsReady(true);
      }
    })();
  }, [user, isUserLoading, initializePosition]);

  return { isReady };
}
