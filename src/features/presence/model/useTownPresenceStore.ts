import { SystemMessage } from "@/features/chat/types";
import { create } from "zustand";

import { PresenceParticipant } from "../types";

interface TownPresenceState {
  participants: PresenceParticipant[];
  isConnected: boolean;
  lastSyncedAt?: string;
  systemMessages: SystemMessage[];
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
  systemMessages: [],
  previousUserIds: new Set(),
  hasInitialized: true,

  setParticipants: (participants, currentUserNickname) => {
    const state = get();
    const currentUserIds = participants.map((p) => p.userId);
    const currentUserIdSet = new Set(currentUserIds);

    let newSystemMessages: SystemMessage[] = [];

    const currentUser = participants.find((p) => p.nickname === currentUserNickname);

    if (state.hasInitialized && currentUser) {
      newSystemMessages = [
        {
          id: `join-${currentUserNickname}-${Date.now()}`,
          type: "join",
          nickname: currentUserNickname,
          created_at: new Date().toISOString(),
        },
      ];

      set({
        participants,
        lastSyncedAt: new Date().toISOString(),
        systemMessages: [...state.systemMessages, ...newSystemMessages],
        previousUserIds: currentUserIdSet,
        hasInitialized: false,
      });

      return;
    }

    if (!state.hasInitialized && state.previousUserIds.size > 0) {
      const newJoins: string[] = [];
      const leaves: string[] = [];

      currentUserIdSet.forEach((userId) => {
        if (!state.previousUserIds.has(userId)) {
          const participant = participants.find((p) => p.userId === userId);
          if (participant) {
            newJoins.push(participant.nickname);
          }
        }
      });

      state.previousUserIds.forEach((userId) => {
        if (!currentUserIdSet.has(userId)) {
          const previousParticipant = state.participants.find((p) => p.userId === userId);
          if (previousParticipant) {
            leaves.push(previousParticipant.nickname);
          }
        }
      });

      if (newJoins.length > 0 || leaves.length > 0) {
        newSystemMessages = [
          ...newJoins.map<SystemMessage>((nickname) => ({
            id: `join-${nickname}-${Date.now()}`,
            type: "join",
            nickname,
            created_at: new Date().toISOString(),
          })),
          ...leaves.map<SystemMessage>((nickname) => ({
            id: `leave-${nickname}-${Date.now()}`,
            type: "leave",
            nickname,
            created_at: new Date().toISOString(),
          })),
        ];
      }
    }

    set({
      participants,
      lastSyncedAt: new Date().toISOString(),
      systemMessages: [...state.systemMessages, ...newSystemMessages],
      previousUserIds: currentUserIdSet,
    });
  },

  setConnectionState: (isConnected) => set({ isConnected }),

  reset: () =>
    set({
      participants: [],
      isConnected: false,
      lastSyncedAt: undefined,
      systemMessages: [],
      previousUserIds: new Set(),
      hasInitialized: true,
    }),
}));
