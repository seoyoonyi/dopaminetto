import { create } from "zustand";

/**
 * 설정(Settings) 모달의 열림 상태만 관리하는 로컬 UI 스토어.
 *
 * - persist하지 않는다. 새로고침하면 모달은 닫힌 상태로 시작한다.
 * - realtime / movement / presence / 서버와 연결하지 않는다.
 * - controlled Dialog의 `onOpenChange`에 그대로 연결하도록 `setOpen` 하나만 노출한다.
 *   React UI와 Phaser Scene 양쪽에서 읽어야 하므로 features가 import 가능한 shared 레이어에 둔다.
 */
interface SettingsDialogState {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

export const useSettingsDialogStore = create<SettingsDialogState>((set) => ({
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
}));
