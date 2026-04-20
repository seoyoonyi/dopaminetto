"use client";

import { VillageId } from "@/entities/village";
import { savePlayerPosition } from "@/features/movement/lib/playerPositionService";
import { Position } from "@/features/movement/model/types";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { supabase } from "@/shared/config/supabase.client";
import { useUserInfo } from "@/shared/hooks/useUserInfo";

import { useEffect, useRef } from "react";

// 영속 저장 주기 (ms)
const SAVE_INTERVAL_MS = 5000;

interface SaveState {
  position: Position;
  villageId: VillageId;
}

/**
 * 플레이어 위치를 필요한 시점에만 DB에 저장한다.
 *
 * 저장 시점 3가지
 * 1. 5초 주기 저장 - 위치가 변경된 경우에만
 * 2. 빌리지 이동 시 즉시 저장
 * 3. 페이지 이탈(pagehide) 시 best-effort 저장 (keepalive fetch)
 *
 * @param enabled - 위치 복원이 완료된 후에만 활성화 (복원 전 기본 위치 저장 방지)
 */
export function useSavePlayerPosition(enabled: boolean) {
  const { data: user } = useUserInfo();
  // 마지막으로 DB에 저장한 상태를 추적해 불필요한 중복 저장을 방지한다
  const lastSavedRef = useRef<SaveState | null>(null);
  // 동시 저장 요청 방지 플래그
  const isSavingRef = useRef(false);
  // pagehide 시 동기적으로 접근해야 해서 ref에 캐싱
  const accessTokenRef = useRef<string | null>(null);

  // 인증 토큰을 ref에 캐싱 (pagehide keepalive fetch에서 사용)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      accessTokenRef.current = data.session?.access_token ?? null;
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      accessTokenRef.current = session?.access_token ?? null;
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // 위치가 변경된 경우에만 저장하는 내부 함수
  const trySave = async (userId: string, villageId: VillageId, position: Position) => {
    if (isSavingRef.current) return;

    const rx = Math.round(position.x);
    const ry = Math.round(position.y);
    const last = lastSavedRef.current;

    // 마지막 저장 위치와 동일하면 저장 생략
    if (last && last.villageId === villageId && last.position.x === rx && last.position.y === ry) {
      return;
    }

    isSavingRef.current = true;
    try {
      await savePlayerPosition(userId, villageId, position);
      lastSavedRef.current = { villageId, position: { x: rx, y: ry } };
    } catch (err) {
      // 저장 실패 시 다음 주기에서 재시도 (lastSavedRef를 갱신하지 않으므로 자동 재시도됨)
      console.error("[useSavePlayerPosition] 저장 실패:", err);
    } finally {
      isSavingRef.current = false;
    }
  };

  // 1. 5초 주기 저장 - 위치가 변경된 경우에만 실행
  useEffect(() => {
    if (!enabled || !user) return;

    const interval = setInterval(() => {
      const { lastSyncedPosition, lastSyncedVillageId } = useMovementStore.getState();
      void trySave(user.id, lastSyncedVillageId, lastSyncedPosition);
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [enabled, user]);

  // 2. 빌리지 이동 시 즉시 저장
  useEffect(() => {
    if (!enabled || !user) return;

    return useMovementStore.subscribe(
      (state) => state.lastSyncedVillageId,
      (villageId) => {
        const { lastSyncedPosition } = useMovementStore.getState();
        void trySave(user.id, villageId, lastSyncedPosition);
      },
    );
  }, [enabled, user]);

  // 3. 페이지 이탈(새로고침/탭 닫기) 시 best-effort 저장
  // keepalive fetch를 사용해 페이지가 언로드된 후에도 요청이 완료될 수 있도록 한다.
  useEffect(() => {
    if (!enabled || !user) return;

    const handlePageHide = () => {
      const { lastSyncedPosition, lastSyncedVillageId } = useMovementStore.getState();
      const rx = Math.round(lastSyncedPosition.x);
      const ry = Math.round(lastSyncedPosition.y);
      const last = lastSavedRef.current;

      // 이미 최신 상태가 저장되어 있으면 생략
      if (
        last &&
        last.villageId === lastSyncedVillageId &&
        last.position.x === rx &&
        last.position.y === ry
      ) {
        return;
      }

      const token = accessTokenRef.current;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!token || !supabaseUrl || !supabaseAnonKey) return;

      // Supabase 클라이언트 대신 fetch keepalive를 직접 사용
      // pagehide 이후에도 브라우저가 요청을 완료할 수 있다
      void fetch(`${supabaseUrl}/rest/v1/user_position`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          user_id: user.id,
          village_id: lastSyncedVillageId,
          x: rx,
          y: ry,
        }),
        keepalive: true,
      });
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [enabled, user]);
}
