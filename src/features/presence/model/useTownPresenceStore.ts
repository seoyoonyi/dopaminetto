import { SystemMessage } from "@/features/chat/types";
import { create } from "zustand";

import { PresenceParticipant } from "../types";

interface TownPresenceState {
  participants: PresenceParticipant[];
  isConnected: boolean;
  lastSyncedAt?: string;
  systemMessages: SystemMessage[];
  previousNicknames: Set<string>;
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
  previousNicknames: new Set(),
  hasInitialized: true,

  setParticipants: (participants, currentUserNickname) => {
    const state = get();
    const currentNicknames = participants.map((p) => p.nickname);
    const currentSet = new Set(currentNicknames);

    let newSystemMessages: SystemMessage[] = [];

    if (state.hasInitialized && currentNicknames.includes(currentUserNickname)) {
      newSystemMessages = [
        {
          id: `join-${currentUserNickname}-${Date.now()}`,
          type: "join",
          nickname: currentUserNickname,
          timestamp: new Date().toISOString(),
        },
      ];

      set({
        participants,
        lastSyncedAt: new Date().toISOString(),
        systemMessages: [...state.systemMessages, ...newSystemMessages],
        previousNicknames: currentSet,
        hasInitialized: false,
      });

      return;
    }

    if (!state.hasInitialized && state.previousNicknames.size > 0) {
      const newJoins: string[] = [];
      const leaves: string[] = [];

      currentSet.forEach((nickname) => {
        if (!state.previousNicknames.has(nickname)) {
          newJoins.push(nickname);
        }
      });

      state.previousNicknames.forEach((nickname) => {
        if (!currentSet.has(nickname)) {
          leaves.push(nickname);
        }
      });

      if (newJoins.length > 0 || leaves.length > 0) {
        newSystemMessages = [
          ...newJoins.map<SystemMessage>((nickname) => ({
            id: `join-${nickname}-${Date.now()}`,
            type: "join",
            nickname,
            timestamp: new Date().toISOString(),
          })),
          ...leaves.map<SystemMessage>((nickname) => ({
            id: `leave-${nickname}-${Date.now()}`,
            type: "leave",
            nickname,
            timestamp: new Date().toISOString(),
          })),
        ];
      }
    }

    set({
      participants,
      lastSyncedAt: new Date().toISOString(),
      systemMessages: [...state.systemMessages, ...newSystemMessages],
      previousNicknames: currentSet,
    });
  },

  setConnectionState: (isConnected) => set({ isConnected }),

  reset: () =>
    set({
      participants: [],
      isConnected: false,
      lastSyncedAt: undefined,
      systemMessages: [],
      previousNicknames: new Set(),
      hasInitialized: true,
    }),
}));
