import { LOBBY_VILLAGE_ID, VillageId } from "@/entities/village";
import { findSafeSpawnPosition, validateMovement } from "@/features/movement/lib/validateMovement";
import { INITIAL_POSITION } from "@/features/movement/model/config";
import { MovementState, Position, RemotePlayer } from "@/features/movement/model/types";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface MovementStore extends MovementState {
  isValidating: boolean; // 동기화 중 표시
  validationLatency: number; // 통신 지연시간(ms)
  pendingDelta: Position; // 아직 서버에 안 보낸 누적 이동량
  lastSyncedPosition: Position; // 서버 검증 완료된 최종 위치
  lastSyncedVillageId: VillageId;

  setUserId: (userId: string) => void;
  setNickname: (nickname: string) => void;
  setPosition: (position: Position) => void;
  setVillage: (villageId: VillageId) => void;
  warp: (position: Position, villageId: VillageId) => void;
  updatePosition: (delta: Position) => void;
  updateRemotePlayer: (player: RemotePlayer) => void;
  removeRemotePlayer: (userId: string) => void;
  removeRemotePlayersOutsideVillages: (visibleVillages: VillageId[]) => void;

  flush: () => Promise<void>;
  reset: () => void;
}

/**
 * 캐릭터 이동 및 서버 동기화 스토어
 */
export const useMovementStore = create<MovementStore>()(
  subscribeWithSelector((set, get) => {
    let lastFlushTime = 0;
    const FLUSH_INTERVAL = 100;
    let isSyncing = false;
    let flushTimeout: ReturnType<typeof setTimeout> | null = null;

    const createJitter = (): Position => ({
      x: INITIAL_POSITION.x + (Math.random() - 0.5) * 60,
      y: INITIAL_POSITION.y + (Math.random() - 0.5) * 60,
    });

    const initialJitter = createJitter();

    return {
      position: initialJitter,
      villageId: LOBBY_VILLAGE_ID,
      nickname: "익명",
      userId: "",
      lastSyncedPosition: initialJitter,
      lastSyncedVillageId: LOBBY_VILLAGE_ID,
      remotePlayers: {},
      isValidating: false,
      validationLatency: 0,
      pendingDelta: { x: 0, y: 0 },

      setUserId: (userId) => set({ userId }),
      setNickname: (nickname) => set({ nickname }),
      setPosition: (position) => set({ position, lastSyncedPosition: position }),
      setVillage: (villageId) => set({ villageId, lastSyncedVillageId: villageId }),

      updateRemotePlayer: (player) =>
        set((state) => ({
          remotePlayers: {
            ...state.remotePlayers,
            [player.userId]: player,
          },
        })),

      removeRemotePlayer: (userId) =>
        set((state) => {
          const newPlayers = { ...state.remotePlayers };
          delete newPlayers[userId];
          return { remotePlayers: newPlayers };
        }),

      removeRemotePlayersOutsideVillages: (visibleVillages) =>
        set((state) => {
          const visibleVillageSet = new Set(visibleVillages);
          let hasChanged = false;
          const nextRemotePlayers: typeof state.remotePlayers = {};

          Object.entries(state.remotePlayers).forEach(([userId, player]) => {
            if (visibleVillageSet.has(player.villageId)) {
              nextRemotePlayers[userId] = player;
              return;
            }

            hasChanged = true;
          });

          if (!hasChanged) {
            return state;
          }

          return { remotePlayers: nextRemotePlayers };
        }),

      /**
       * 좌표/마을 동시 전환 및 델타 리셋
       */
      warp: (position, villageId) => {
        const safePos = findSafeSpawnPosition(position, get().remotePlayers, villageId);
        set({
          position: safePos,
          villageId,
          lastSyncedPosition: safePos,
          lastSyncedVillageId: villageId,
          pendingDelta: { x: 0, y: 0 },
        });
      },

      /**
       * 낙관적 업데이트 및 이동량 누적
       */
      updatePosition: (delta) => {
        const { position, villageId, pendingDelta } = get();

        const result = validateMovement(position, villageId, delta);
        const actualDeltaX = result.nextPosition.x - position.x;
        const actualDeltaY = result.nextPosition.y - position.y;

        const isVillageChanged = result.nextVillageId !== villageId;

        set({
          position: result.nextPosition,
          villageId: result.nextVillageId,
          pendingDelta: {
            x: pendingDelta.x + actualDeltaX,
            y: pendingDelta.y + actualDeltaY,
          },
        });

        // 동기화 실행
        const now = performance.now();
        // 마을이 변경된 경우 지연 없이 즉시 전송, 그 외에는 Throttling 적용
        if (isVillageChanged || (now - lastFlushTime > FLUSH_INTERVAL && !isSyncing)) {
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
        const { pendingDelta, lastSyncedPosition, lastSyncedVillageId } = get();
        if (isSyncing || (pendingDelta.x === 0 && pendingDelta.y === 0)) return;

        isSyncing = true;
        set({ isValidating: true });
        lastFlushTime = performance.now();

        const snapshotDelta = { ...pendingDelta };
        const basePosition = { ...lastSyncedPosition };
        const baseVillageId = lastSyncedVillageId;
        set({ pendingDelta: { x: 0, y: 0 } });

        try {
          const startTime = performance.now();
          // [API 입점 예정지] fetch/socket 통신 연결부
          const validationResult = validateMovement(basePosition, baseVillageId, snapshotDelta);
          const endTime = performance.now();

          set({
            lastSyncedPosition: validationResult.nextPosition,
            lastSyncedVillageId: validationResult.nextVillageId,
            validationLatency: endTime - startTime,
          });

          // 마을 전환 시에는 재보정 없이 서버 위치로 스냅
          if (validationResult.nextVillageId !== baseVillageId) {
            const safePos = findSafeSpawnPosition(
              validationResult.nextPosition,
              get().remotePlayers,
              validationResult.nextVillageId,
            );
            set({
              position: safePos,
              villageId: validationResult.nextVillageId,
              pendingDelta: { x: 0, y: 0 },
            });
            return;
          }

          /**
           * Reconciliation: 서버 검증 결과 기점으로 그 사이의 미전송 이동량을 다시 적용
           */
          const currentBuffer = { ...get().pendingDelta };
          const finalReconciliation = validateMovement(
            validationResult.nextPosition,
            validationResult.nextVillageId,
            currentBuffer,
          );

          set({
            position: finalReconciliation.nextPosition,
            villageId: finalReconciliation.nextVillageId,
            pendingDelta: {
              x: finalReconciliation.nextPosition.x - validationResult.nextPosition.x,
              y: finalReconciliation.nextPosition.y - validationResult.nextPosition.y,
            },
          });
        } catch (error) {
          console.error("Movement sync failed:", error);

          const current = get().pendingDelta;
          set({
            pendingDelta: {
              x: current.x + snapshotDelta.x,
              y: current.y + snapshotDelta.y,
            },
          });
        } finally {
          isSyncing = false;
          set({ isValidating: false });
        }
      },
      reset: () => {
        const newJitter = createJitter();
        set({
          position: newJitter,
          villageId: LOBBY_VILLAGE_ID,
          nickname: "익명",
          userId: "",
          lastSyncedPosition: newJitter,
          lastSyncedVillageId: LOBBY_VILLAGE_ID,
          remotePlayers: {},
          isValidating: false,
          validationLatency: 0,
          pendingDelta: { x: 0, y: 0 },
        });
      },
    };
  }),
);
