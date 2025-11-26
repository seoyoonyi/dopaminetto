import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserStoreState {
  userId: string;
  userNickname: string;
  setUserNickname: (nickname: string) => void;
  reset: () => void;
}

export const useUserStore = create<UserStoreState>()(
  persist(
    (set, get) => ({
      userId: "",
      userNickname: "",
      setUserNickname: (nickname) => {
        const currentUserId = get().userId;
        set({
          userNickname: nickname,
          userId: currentUserId || uuidv4(),
        });
      },
      reset: () => set({ userId: "", userNickname: "" }),
    }),
    {
      name: "user-storage",
    },
  ),
);
