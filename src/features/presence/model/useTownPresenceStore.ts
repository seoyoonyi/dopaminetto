import { toast } from "sonner";
import { create } from "zustand";

import { PresenceParticipant } from "../types";

interface TownPresenceState {
  participants: PresenceParticipant[];
  isConnected: boolean;
  lastSyncedAt?: string;
  previousUserIds: Set<string>;
  hasInitialized: boolean;

  setParticipants: (participants: PresenceParticipant[], currentUserNickname: string) => void;
  setConnectionState: (isConnected: boolean) => void;
  reset: () => void;
}

export const useTownPresenceStore = create<TownPresenceState>((set, get) => ({
  participants: [],
  isConnected: false,
  lastSyncedAt: undefined,
  previousUserIds: new Set(),
  hasInitialized: true,

  setParticipants: (participants, currentUserNickname) => {
    const state = get();
    const currentUserIds = participants.map((p) => p.userId);
    const currentUserIdSet = new Set(currentUserIds);

    const currentUser = participants.find((p) => p.nickname === currentUserNickname);

    if (state.hasInitialized && currentUser) {
      toast(`${currentUserNickname} 입장했습니다.`, { duration: 3000 });

      set({
        participants,
        lastSyncedAt: new Date().toISOString(),
        previousUserIds: currentUserIdSet,
        hasInitialized: false,
      });

      return;
    }

    if (!state.hasInitialized && state.previousUserIds.size > 0) {
      currentUserIdSet.forEach((userId) => {
        if (!state.previousUserIds.has(userId)) {
          const participant = participants.find((p) => p.userId === userId);
          if (participant) {
            toast(`${participant.nickname} 입장했습니다.`, { duration: 3000 });
          }
        }
      });

      state.previousUserIds.forEach((userId) => {
        if (!currentUserIdSet.has(userId)) {
          const previousParticipant = state.participants.find((p) => p.userId === userId);
          if (previousParticipant) {
            toast(`${previousParticipant.nickname} 퇴장했습니다.`, { duration: 3000 });
          }
        }
      });
    }

    set({
      participants,
      lastSyncedAt: new Date().toISOString(),
      previousUserIds: currentUserIdSet,
    });
  },

  setConnectionState: (isConnected) => set({ isConnected }),

  reset: () =>
    set({
      participants: [],
      isConnected: false,
      lastSyncedAt: undefined,
      previousUserIds: new Set(),
      hasInitialized: true,
    }),
}));
