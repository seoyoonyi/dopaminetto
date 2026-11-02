import { create } from "zustand";

interface GuestbookDialogState {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  setOpen: (open: boolean, position?: { x: number; y: number }) => void;
}

export const useGuestbookDialogStore = create<GuestbookDialogState>((set) => ({
  isOpen: false,
  position: null,
  setOpen: (open, position) => set({ isOpen: open, position: open ? (position ?? null) : null }),
}));
