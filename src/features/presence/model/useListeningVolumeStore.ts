import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const LISTENING_VOLUME_STORAGE_KEY = "listener-broadcast-volume";

interface ListeningVolumeState {
  listeningVolume: number;
  setListeningVolume: (listeningVolume: number) => void;
}

const clampVolume = (listeningVolume: number) => Math.min(1, Math.max(0, listeningVolume));

/**
 * Listener의 방송 음량을 브라우저 프로필 단위로 유지한다.
 * 서버나 Presence payload에는 저장하지 않는 로컬 출력 설정이다.
 */
export const useListeningVolumeStore = create<ListeningVolumeState>()(
  persist(
    (set) => ({
      listeningVolume: 1,
      setListeningVolume: (listeningVolume) =>
        set({ listeningVolume: clampVolume(listeningVolume) }),
    }),
    {
      name: LISTENING_VOLUME_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
