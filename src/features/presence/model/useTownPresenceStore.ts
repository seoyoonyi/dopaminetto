import { VillageId } from "@/entities/village";
import { toast } from "sonner";
import { create } from "zustand";

import { groupParticipantsByVillage } from "../lib/groupByVillage";
import { PresenceParticipant } from "../types";
import { resolvePresenceParticipants } from "./presenceParticipants";

const DEPARTURE_FALLBACK_MS = 8000;

interface TownPresenceState {
  participants: PresenceParticipant[];
  groupedParticipants: Partial<Record<VillageId, PresenceParticipant[]>>;
  isConnected: boolean;
  lastSyncedAt?: string;
  localJoinedAt: string;
  previousUserIds: Set<string>;
  pendingDepartures: Map<string, ReturnType<typeof setTimeout>>;
  hasInitialized: boolean;
  /** 현재 유저의 음성 채널 연결 여부. presence track payload에 포함되어 다른 유저에게 공유된다. */
  voiceConnected: boolean;
  /** 현재 유저의 발표용 마이크 활성 여부. presence track payload에 포함되어 다른 유저에게 공유된다. */
  audioEnabled: boolean;
  /** 현재 유저가 툴바 음성 제어 UI에서 마이크 토글을 제어할 수 있는지 여부 */
  canToggleAudio: boolean;
  /** 현재 유저의 마이크 토글을 수행하는 로컬 제어 함수 */
  toggleLocalAudio: (() => Promise<void>) | null;
  /**
   * 마이크 토글 SDK 호출이 진행 중인지 여부.
   * true인 동안 버튼을 disabled 처리해 중복 클릭을 막는다.
   */
  isAudioToggling: boolean;
  /** 현재 유저가 툴바 음성 제어 UI에서 청취 토글을 제어할 수 있는지 여부 */
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
  /** 툴바 음성 제어 UI에서 사용할 마이크 토글 제어기를 등록한다. */
  setAudioController: (
    canToggleAudio: boolean,
    toggleLocalAudio: (() => Promise<void>) | null,
  ) => void;
  /** 마이크 토글 SDK 호출 진행 상태를 업데이트한다. */
  setAudioToggling: (isAudioToggling: boolean) => void;
  /** 툴바 음성 제어 UI에서 사용할 청취 토글 제어기를 등록한다. */
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
  pendingDepartures: new Map(),
  hasInitialized: true,
  voiceConnected: false,
  audioEnabled: false,
  canToggleAudio: false,
  toggleLocalAudio: null,
  isAudioToggling: false,
  canToggleListening: false,
  listeningEnabled: true,
  toggleLocalListening: null,

  setParticipants: (participants, _currentUserNickname, currentUserId) => {
    const state = get();
    const pendingDepartures = new Map(state.pendingDepartures);
    const resolvedParticipants = resolvePresenceParticipants({
      currentUserId,
      hasInitialized: state.hasInitialized,
      nextParticipants: participants,
      pendingDepartureUserIds: new Set(pendingDepartures.keys()),
      previousParticipants: state.participants,
      previousUserIds: state.previousUserIds,
    });

    resolvedParticipants.recoveredPendingDepartureUserIds.forEach((userId) => {
      const timerId = pendingDepartures.get(userId);
      if (!timerId) return;

      clearTimeout(timerId);
      pendingDepartures.delete(userId);
    });

    resolvedParticipants.departureCandidates.forEach((previousParticipant) => {
      const userId = previousParticipant.userId;
      const timerId = setTimeout(() => {
        const latestState = get();
        if (!latestState.pendingDepartures.has(userId)) {
          return;
        }

        const nextPendingDepartures = new Map(latestState.pendingDepartures);
        nextPendingDepartures.delete(userId);

        const nextParticipants = latestState.participants.filter((p) => p.userId !== userId);
        const nextUserIdSet = new Set(nextParticipants.map((p) => p.userId));

        toast(`${previousParticipant.nickname} 퇴장했습니다.`, { duration: 3000 });

        set({
          participants: nextParticipants,
          groupedParticipants: groupParticipantsByVillage(nextParticipants),
          lastSyncedAt: new Date().toISOString(),
          previousUserIds: nextUserIdSet,
          pendingDepartures: nextPendingDepartures,
        });
      }, DEPARTURE_FALLBACK_MS);

      pendingDepartures.set(userId, timerId);
    });

    const groupedParticipants = groupParticipantsByVillage(
      resolvedParticipants.displayParticipants,
    );

    if (resolvedParticipants.initialJoinParticipant) {
      toast(`${resolvedParticipants.initialJoinParticipant.nickname} 입장했습니다.`, {
        duration: 3000,
      });

      set({
        participants: resolvedParticipants.displayParticipants,
        groupedParticipants,
        lastSyncedAt: new Date().toISOString(),
        previousUserIds: resolvedParticipants.currentUserIdSet,
        pendingDepartures,
        hasInitialized: false,
      });

      return;
    }

    resolvedParticipants.joinToastParticipants.forEach((participant) => {
      toast(`${participant.nickname} 입장했습니다.`, { duration: 3000 });
    });

    set({
      participants: resolvedParticipants.displayParticipants,
      groupedParticipants,
      lastSyncedAt: new Date().toISOString(),
      previousUserIds: resolvedParticipants.currentUserIdSet,
      pendingDepartures,
    });
  },

  setConnectionState: (isConnected) => set({ isConnected }),

  setVoiceConnected: (voiceConnected) => set({ voiceConnected }),

  /**
   * 발표용 마이크 활성 상태를 업데이트하고 presence track이 재전송되도록 한다.
   */
  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),

  /**
   * 툴바 음성 제어 UI에서 사용할 마이크 토글 제어기를 등록한다.
   */
  setAudioController: (canToggleAudio, toggleLocalAudio) =>
    set({
      canToggleAudio,
      toggleLocalAudio,
    }),

  setAudioToggling: (isAudioToggling) => set({ isAudioToggling }),

  /**
   * 툴바 음성 제어 UI에서 사용할 청취 토글 제어기를 등록한다.
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

  reset: () => {
    get().pendingDepartures.forEach((timerId) => {
      clearTimeout(timerId);
    });

    set({
      participants: [],
      groupedParticipants: {},
      isConnected: false,
      lastSyncedAt: undefined,
      previousUserIds: new Set(),
      pendingDepartures: new Map(),
      hasInitialized: true,
      voiceConnected: false,
      audioEnabled: false,
      canToggleAudio: false,
      toggleLocalAudio: null,
      isAudioToggling: false,
      canToggleListening: false,
      listeningEnabled: true,
      toggleLocalListening: null,
    });
  },
}));
