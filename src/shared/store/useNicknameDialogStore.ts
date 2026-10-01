import { create } from "zustand";

/** React 변경창과 Phaser 입력 차단에서 공유하는 일시적인 열림 상태다. */
interface NicknameDialogState {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

export const useNicknameDialogStore = create<NicknameDialogState>((set) => ({
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
}));
