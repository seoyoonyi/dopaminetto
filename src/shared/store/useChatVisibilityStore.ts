import { create } from "zustand";

interface ChatVisibilityState {
  visiblePageIndices: Set<number>;
  actions: {
    setVisiblePages: (pageIndices: Set<number>) => void;
  };
}

/**
 * 채팅 화면에 보이는 페이지들의 인덱스를 관리하는 Zustand 스토어입니다.
 *
 * 목적:
 * - 빠른 스크롤 이벤트에 대응하여 가시성 상태를 즉시 업데이트하고,
 * - 무거운 작업(서버 동기화 등)은 이 스토어를 구독하여 지연 처리(Debounce)하기 위함입니다.
 */
export const useChatVisibilityStore = create<ChatVisibilityState>((set) => ({
  visiblePageIndices: new Set(),
  actions: {
    setVisiblePages: (pageIndices) => set({ visiblePageIndices: pageIndices }),
  },
}));

export const useChatVisibilityActions = () => useChatVisibilityStore((state) => state.actions);
export const useVisiblePageIndices = () =>
  useChatVisibilityStore((state) => state.visiblePageIndices);
