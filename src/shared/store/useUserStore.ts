import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserStoreState {
  userNickname: string;
  setUserNickname: (nickname: string) => void;
}

export const useUserStore = create<UserStoreState>()(
  persist(
    (set) => ({
      userNickname: "",
      setUserNickname: (nickname) => set({ userNickname: nickname }),
    }),
    {
      name: "user-storage",
    },
  ),
);
