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
  /** 현재 유저의 음성 채널 연결 여부. presence track payload에 포함되어 다른 유저에게 공유된다. */
  voiceConnected: boolean;
  /** 현재 유저의 발표용 마이크 활성 여부. presence track payload에 포함되어 다른 유저에게 공유된다. */
  audioEnabled: boolean;
  /** 현재 유저가 사용자 패널에서 마이크 토글을 제어할 수 있는지 여부 */
  canToggleAudio: boolean;
  /** 현재 유저의 마이크 토글을 수행하는 로컬 제어 함수 */
  toggleLocalAudio: (() => Promise<void>) | null;
  /** 현재 유저가 사용자 패널에서 청취 토글을 제어할 수 있는지 여부 */
  canToggleListening: boolean;
  /** 현재 유저의 실제 청취 on/off 상태 */
  listeningEnabled: boolean;
  /** 현재 유저의 청취 on/off를 수행하는 로컬 제어 함수 */
  toggleLocalListening: (() => Promise<void>) | null;

  setParticipants: (
    participants: PresenceParticipant[],
    currentUserNickname: string,
    currentUserId: string,
  ) => void;
  setConnectionState: (isConnected: boolean) => void;
  /** 음성 연결 상태를 업데이트하고 presence track이 재전송되도록 한다. */
  setVoiceConnected: (voiceConnected: boolean) => void;
  /** 발표용 마이크 활성 상태를 업데이트하고 presence track이 재전송되도록 한다. */
  setAudioEnabled: (audioEnabled: boolean) => void;
  /** 사용자 패널에서 사용할 마이크 토글 제어기를 등록한다. */
  setAudioController: (
    canToggleAudio: boolean,
    toggleLocalAudio: (() => Promise<void>) | null,
  ) => void;
  /** 사용자 패널에서 사용할 청취 토글 제어기를 등록한다. */
  setListeningController: (
    canToggleListening: boolean,
    toggleLocalListening: (() => Promise<void>) | null,
  ) => void;
  /** 현재 유저의 청취 on/off 상태를 업데이트한다. */
  setListeningEnabled: (listeningEnabled: boolean) => void;
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
  voiceConnected: false,
  audioEnabled: false,
  canToggleAudio: false,
  toggleLocalAudio: null,
  canToggleListening: false,
  listeningEnabled: true,
  toggleLocalListening: null,

  setParticipants: (participants, currentUserNickname, currentUserId) => {
    const sortedParticipants = [...participants].sort((a, b) =>
      a.nickname.localeCompare(b.nickname, "ko"),
    );
    const groupedParticipants = groupParticipantsByVillage(sortedParticipants);

    const state = get();
    const currentUserIds = sortedParticipants.map((p) => p.userId);
    const currentUserIdSet = new Set(currentUserIds);

    // 닉네임 대신 userId로 정확하게 자신을 식별 (유저 제안 사항)
    const me = sortedParticipants.find((p) => p.userId === currentUserId);

    if (state.hasInitialized && me) {
      toast(`${me.nickname} 입장했습니다.`, { duration: 3000 });

      set({
        participants: sortedParticipants,
        groupedParticipants,
        lastSyncedAt: new Date().toISOString(),
        previousUserIds: currentUserIdSet,
        hasInitialized: false,
      });

      return;
    }

    if (!state.hasInitialized && state.previousUserIds.size > 0) {
      currentUserIdSet.forEach((userId) => {
        if (!state.previousUserIds.has(userId)) {
          const participant = sortedParticipants.find((p) => p.userId === userId);
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
      participants: sortedParticipants,
      groupedParticipants,
      lastSyncedAt: new Date().toISOString(),
      previousUserIds: currentUserIdSet,
    });
  },

  setConnectionState: (isConnected) => set({ isConnected }),

  setVoiceConnected: (voiceConnected) => set({ voiceConnected }),

  /**
   * 발표용 마이크 활성 상태를 업데이트하고 presence track이 재전송되도록 한다.
   */
  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),

  /**
   * 사용자 패널에서 사용할 마이크 토글 제어기를 등록한다.
   */
  setAudioController: (canToggleAudio, toggleLocalAudio) =>
    set({
      canToggleAudio,
      toggleLocalAudio,
    }),

  /**
   * 사용자 패널에서 사용할 청취 토글 제어기를 등록한다.
   */
  setListeningController: (canToggleListening, toggleLocalListening) =>
    set({
      canToggleListening,
      toggleLocalListening,
    }),

  /**
   * 현재 유저의 청취 on/off 상태를 업데이트한다.
   */
  setListeningEnabled: (listeningEnabled) => set({ listeningEnabled }),

  reset: () =>
    set({
      participants: [],
      groupedParticipants: {},
      isConnected: false,
      lastSyncedAt: undefined,
      previousUserIds: new Set(),
      hasInitialized: true,
      voiceConnected: false,
      audioEnabled: false,
      canToggleAudio: false,
      toggleLocalAudio: null,
      canToggleListening: false,
      listeningEnabled: true,
      toggleLocalListening: null,
    }),
}));
