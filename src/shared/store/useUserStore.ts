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
      /**
       * 사용자의 닉네임을 설정합니다.
       * userId가 아직 없다면 새 UUID를 생성합니다.
       * currentUserId를 유지하는 이유:
       *   한 사람이 브라우저에서 같은 탭을 여러 개 열어도 각각 다른 userId를 만들지 않기 위함입니다.
       */
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
