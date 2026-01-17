import { VillageId } from "@/entities/village";
import { validateMovement } from "@/features/movement/lib/validateMovement";
import { INITIAL_POSITION } from "@/features/movement/model/config";
import { MovementState, Position } from "@/features/movement/model/types";
import { create } from "zustand";

interface MovementStore extends MovementState {
  isValidating: boolean; // 동기화 중 표시
  validationLatency: number; // 통신 지연시간(ms)
  pendingDelta: Position; // 아직 서버에 안 보낸 누적 이동량
  lastSyncedPosition: Position; // 서버 검증 완료된 최종 위치
  lastSyncedVillageId: VillageId;

  setPosition: (position: Position) => void;
  setVillage: (villageId: VillageId) => void;
  warp: (position: Position, villageId: VillageId) => void;
  updatePosition: (delta: Position) => void;
  flush: () => Promise<void>;
}

/**
 * 캐릭터 이동 및 서버 동기화 스토어
 */
export const useMovementStore = create<MovementStore>((set, get) => {
  let lastFlushTime = 0;
  const FLUSH_INTERVAL = 100;
  let isSyncing = false;
  let flushTimeout: ReturnType<typeof setTimeout> | null = null;

  return {
    position: INITIAL_POSITION,
    villageId: "village-a",
    lastSyncedPosition: INITIAL_POSITION,
    lastSyncedVillageId: "village-a",
    isValidating: false,
    validationLatency: 0,
    pendingDelta: { x: 0, y: 0 },

    setPosition: (position) => set({ position, lastSyncedPosition: position }),
    setVillage: (villageId) => set({ villageId, lastSyncedVillageId: villageId }),

    /**
     * 좌표/마을 동시 전환 및 델타 리셋
     */
    warp: (position, villageId) =>
      set({
        position,
        villageId,
        lastSyncedPosition: position,
        lastSyncedVillageId: villageId,
        pendingDelta: { x: 0, y: 0 },
      }),

    /**
     * 낙관적 업데이트 및 이동량 누적
     */
    updatePosition: (delta) => {
      const { position, villageId, pendingDelta } = get();

      const result = validateMovement(position, villageId, delta);
      const actualDeltaX = result.nextPosition.x - position.x;
      const actualDeltaY = result.nextPosition.y - position.y;

      set({
        position: result.nextPosition,
        villageId: result.nextVillageId,
        pendingDelta: {
          x: pendingDelta.x + actualDeltaX,
          y: pendingDelta.y + actualDeltaY,
        },
      });

      // 동기화 실행 (Throttling)
      const now = performance.now();
      if (now - lastFlushTime > FLUSH_INTERVAL && !isSyncing) {
        void get().flush();
      }

      // 입력 중지 시 잔여 데이터 전송용 타이머
      if (flushTimeout) clearTimeout(flushTimeout);
      flushTimeout = setTimeout(() => {
        void get().flush();
      }, FLUSH_INTERVAL + 20);
    },

    /**
     * 서버 동기화 및 Reconciliation(보정) 실행
     */
    flush: async () => {
      const { pendingDelta } = get();
      if (isSyncing || (pendingDelta.x === 0 && pendingDelta.y === 0)) return;

      isSyncing = true;
      set({ isValidating: true });
      lastFlushTime = performance.now();

      try {
        while (true) {
          const { pendingDelta: currentBuffer, lastSyncedPosition, lastSyncedVillageId } = get();
          if (currentBuffer.x === 0 && currentBuffer.y === 0) break;

          const deltaToSync = { ...currentBuffer };
          const basePosition = { ...lastSyncedPosition };
          const baseVillageId = lastSyncedVillageId;

          set({ pendingDelta: { x: 0, y: 0 } });

          const startTime = performance.now();
          // [API 입점 예정지] fetch/socket 통신 연결부
          const validationResult = validateMovement(basePosition, baseVillageId, deltaToSync);
          const endTime = performance.now();

          set({
            lastSyncedPosition: validationResult.nextPosition,
            lastSyncedVillageId: validationResult.nextVillageId,
            validationLatency: endTime - startTime,
          });

          // 마을 전환 시에는 재보정 없이 서버 위치로 스냅
          if (validationResult.nextVillageId !== baseVillageId) {
            set({
              position: validationResult.nextPosition,
              villageId: validationResult.nextVillageId,
              pendingDelta: { x: 0, y: 0 },
            });
            continue;
          }

          /**
           * Reconciliation: 서버 검증 결과 기점으로 그 사이의 미전송 이동량을 다시 적용
           */
          const extraDelta = { ...get().pendingDelta };
          const finalReconciliation = validateMovement(
            validationResult.nextPosition,
            validationResult.nextVillageId,
            extraDelta,
          );

          set({
            position: finalReconciliation.nextPosition,
            villageId: finalReconciliation.nextVillageId,
            pendingDelta: { x: 0, y: 0 },
          });
        }
      } finally {
        isSyncing = false;
        set({ isValidating: false });
      }
    },
  };
});
