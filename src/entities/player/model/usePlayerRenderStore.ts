import { create } from "zustand";

interface PlayerRenderState {
  isSceneReady: boolean;
  /** 인증 ID가 아닌 movement의 브라우저 생성 플레이어 ID 집합이다. */
  renderedUserIds: ReadonlySet<string>;
  publishRenderedPlayers: (userIds: readonly string[]) => void;
  reset: () => void;
}

/** 현재 Scene에서 렌더가 완료된 플레이어만 공유한다. */
export const usePlayerRenderStore = create<PlayerRenderState>((set) => ({
  isSceneReady: false,
  renderedUserIds: new Set(),
  publishRenderedPlayers: (userIds) =>
    set((state) => {
      const renderedUserIds = new Set(userIds);
      if (
        state.isSceneReady &&
        state.renderedUserIds.size === renderedUserIds.size &&
        userIds.every((userId) => state.renderedUserIds.has(userId))
      ) {
        return state;
      }
      return { isSceneReady: true, renderedUserIds };
    }),
  reset: () => set({ isSceneReady: false, renderedUserIds: new Set() }),
}));
