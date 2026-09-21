import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PresenceNotificationState {
  isPresenceNotificationEnabled: boolean;
  togglePresenceNotification: () => void;
}

const STORAGE_KEY = "town-presence-settings";

const sanitizePersistedState = (persistedState: unknown) => {
  const state =
    persistedState && typeof persistedState === "object" && !Array.isArray(persistedState)
      ? (persistedState as Partial<PresenceNotificationState>)
      : {};

  return {
    isPresenceNotificationEnabled:
      typeof state.isPresenceNotificationEnabled === "boolean"
        ? state.isPresenceNotificationEnabled
        : true,
  };
};

export const usePresenceNotificationStore = create<PresenceNotificationState>()(
  persist(
    (set) => ({
      isPresenceNotificationEnabled: true,
      togglePresenceNotification: () =>
        set((state) => ({
          isPresenceNotificationEnabled: !state.isPresenceNotificationEnabled,
        })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (state) => ({
        isPresenceNotificationEnabled: state.isPresenceNotificationEnabled,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitizePersistedState(persistedState),
      }),
    },
  ),
);
