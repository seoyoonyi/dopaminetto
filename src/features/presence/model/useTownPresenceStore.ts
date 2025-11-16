import { create } from "zustand";

import { PresenceParticipant } from "../types";

interface TownPresenceState {
  participants: PresenceParticipant[];
  isConnected: boolean;
  /**
   * Presence 목록이 마지막으로 갱신된 시각
   * 향후 UI에서 최근 동기화 정보를 표시할 때 활용 예정
   */
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
