import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const LISTENING_VOLUME_STORAGE_KEY = "listener-broadcast-volume";

interface ListeningVolumeState {
  listeningVolume: number;
  lastAudibleListeningVolume: number;
  setListeningVolume: (listeningVolume: number) => void;
}

const clampVolume = (listeningVolume: number) => Math.min(1, Math.max(0, listeningVolume));

const getStoredVolume = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? clampVolume(value) : undefined;

const sanitizeStoredState = (persistedState: unknown) => {
  const state =
    persistedState && typeof persistedState === "object" && !Array.isArray(persistedState)
      ? (persistedState as Partial<ListeningVolumeState>)
      : {};
  const listeningVolume = getStoredVolume(state.listeningVolume) ?? 1;
  const fallbackLastAudibleVolume = listeningVolume > 0 ? listeningVolume : 1;
  const storedLastAudibleVolume = getStoredVolume(state.lastAudibleListeningVolume);

  return {
    listeningVolume,
    lastAudibleListeningVolume:
      storedLastAudibleVolume && storedLastAudibleVolume > 0
        ? storedLastAudibleVolume
        : fallbackLastAudibleVolume,
  };
};

/**
 * Listener의 방송 음량을 브라우저 프로필 단위로 유지한다.
 * 서버나 Presence payload에는 저장하지 않는 로컬 출력 설정이다.
 */
export const useListeningVolumeStore = create<ListeningVolumeState>()(
  persist(
    (set) => ({
      listeningVolume: 1,
      lastAudibleListeningVolume: 1,
      setListeningVolume: (listeningVolume) => {
        const nextListeningVolume = clampVolume(listeningVolume);

        set((state) => ({
          listeningVolume: nextListeningVolume,
          lastAudibleListeningVolume:
            nextListeningVolume > 0 ? nextListeningVolume : state.lastAudibleListeningVolume,
        }));
      },
    }),
    {
      name: LISTENING_VOLUME_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 1,
      migrate: (persistedState) => sanitizeStoredState(persistedState),
      // 같은 버전의 저장값도 hydrate 시 정규화해 비정상적인 로컬 값이 상태에 들어오지 않게 한다.
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizeStoredState(persistedState),
      }),
    },
  ),
);
