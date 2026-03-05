import { VillageId } from "@/entities/village";
import { toast } from "sonner";
import { create } from "zustand";

import { groupParticipantsByVillage } from "../lib/groupByVillage";
import { PresenceParticipant } from "../types";

interface TownPresenceState {
  participants: PresenceParticipant[];
  groupedParticipants: Partial<Record<VillageId, PresenceParticipant[]>>;
  isConnected: boolean;
  lastSyncedAt?: string;
  localJoinedAt: string;
  previousUserIds: Set<string>;
  hasInitialized: boolean;

  setParticipants: (
    participants: PresenceParticipant[],
    currentUserNickname: string,
    currentUserId: string,
  ) => void;
  setConnectionState: (isConnected: boolean) => void;
  reset: () => void;
}

export const useTownPresenceStore = create<TownPresenceState>((set, get) => ({
  participants: [],
  groupedParticipants: {},
  isConnected: false,
  lastSyncedAt: undefined,
  localJoinedAt: new Date().toISOString(),
  previousUserIds: new Set(),
  hasInitialized: true,

  setParticipants: (participants, currentUserNickname, currentUserId) => {
    const state = get();
    const currentUserIds = participants.map((p) => p.userId);
    const currentUserIdSet = new Set(currentUserIds);

    // 닉네임 대신 userId로 정확하게 자신을 식별 (유저 제안 사항)
    const me = participants.find((p) => p.userId === currentUserId);

    if (state.hasInitialized && me) {
      toast(`${me.nickname} 입장했습니다.`, { duration: 3000 });

      set({
        participants,
        groupedParticipants: groupParticipantsByVillage(participants),
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
      groupedParticipants: groupParticipantsByVillage(participants),
      lastSyncedAt: new Date().toISOString(),
      previousUserIds: currentUserIdSet,
    });
  },

  setConnectionState: (isConnected) => set({ isConnected }),

  reset: () =>
    set({
      participants: [],
      groupedParticipants: {},
      isConnected: false,
      lastSyncedAt: undefined,
      previousUserIds: new Set(),
      hasInitialized: true,
    }),
}));
