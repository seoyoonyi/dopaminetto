import { create } from "zustand";

export type TownPanel = "chat" | "users";

interface TownPanelToggleState {
  activePanel: TownPanel;
  togglePanel: () => void;
  setActivePanel: (panel: TownPanel) => void;
}

/**
 * 채팅/사용자 패널 토글 상태를 관리하는 스토어.
 * - activePanel: 현재 표시 중인 패널
 * - togglePanel: 버튼 클릭 등으로 패널 전환
 * - setActivePanel: 직접적으로 특정 패널을 표시하도록 지정
 */
export const useTownPanelToggleStore = create<TownPanelToggleState>((set) => ({
  activePanel: "chat",
  togglePanel: () =>
    set((state) => ({
      activePanel: state.activePanel === "chat" ? "users" : "chat",
    })),
  setActivePanel: (panel) => set({ activePanel: panel }),
}));
