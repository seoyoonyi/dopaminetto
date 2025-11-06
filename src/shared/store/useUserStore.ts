import { create } from "zustand";

interface UserStoreState {
  userNickname: string;
  setUserNickname: (nickname: string) => void;
}

export const useUserStore = create<UserStoreState>((set) => ({
  userNickname: "",
  setUserNickname: (nickname) => set({ userNickname: nickname }),
}));
