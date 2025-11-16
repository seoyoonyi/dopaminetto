import { create } from "zustand";

import { PresenceParticipant } from "../types";

interface TownPresenceState {
  participants: PresenceParticipant[];
  isConnected: boolean;
  lastSyncedAt?: string;
  setParticipants: (participants: PresenceParticipant[]) => void;
  setConnectionState: (isConnected: boolean) => void;
  reset: () => void;
}

export const useTownPresenceStore = create<TownPresenceState>((set) => ({
  participants: [],
  isConnected: false,
  lastSyncedAt: undefined,
  setParticipants: (participants) =>
    set({
      participants,
      lastSyncedAt: new Date().toISOString(),
    }),
  setConnectionState: (isConnected) => set({ isConnected }),
  reset: () =>
    set({
      participants: [],
      isConnected: false,
      lastSyncedAt: undefined,
    }),
}));
