import { create } from "zustand";

interface GuestbookDialogState {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

export const useGuestbookDialogStore = create<GuestbookDialogState>((set) => ({
  isOpen: false,
  setOpen: (open) => set({ isOpen: open }),
}));
