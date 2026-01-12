import { VillageId } from "@/entities/village";
import { validateMovement } from "@/features/movement/lib/validateMovement";
import { INITIAL_POSITION } from "@/features/movement/model/config";
import { MOVEMENT_EVENT_TYPES, MovementState, Position } from "@/features/movement/model/types";
import { create } from "zustand";

interface MovementStore extends MovementState {
  setPosition: (position: Position) => void;
  setVillage: (villageId: VillageId) => void;
  updatePosition: (delta: Position) => void;
}

export const useMovementStore = create<MovementStore>((set, get) => ({
  position: INITIAL_POSITION,
  villageId: "village-a",

  setPosition: (position) => set({ position }),
  setVillage: (villageId) => set({ villageId }),

  updatePosition: (delta) => {
    const { position, villageId } = get();
    const result = validateMovement(position, villageId, delta);

    // 검증 결과에 따라 마을 전환 이벤트가 발생했는지 체크
    if (result.event.type === MOVEMENT_EVENT_TYPES.VILLAGE_CHANGE) {
      set({
        villageId: result.nextVillageId,
        position: result.nextPosition,
      });
    } else {
      // 일반 이동인 경우 좌표만 업데이트
      set({ position: result.nextPosition });
    }
  },
}));
