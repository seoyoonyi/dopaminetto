import { VillageId } from "@/entities/village";
import { TOWN_MAIN_CHANNEL } from "@/shared/lib/realtime";
import {
  DEPARTURE_GRACE_MS,
  createDepartureGraceController,
} from "@/shared/lib/realtime/departureGrace";
import { getTownChannelStatus } from "@/shared/lib/realtime/townChannelManager";
import { toast } from "sonner";
import { create } from "zustand";

import { groupParticipantsByVillage } from "../lib/groupByVillage";
import { PresenceParticipant } from "../types";
import { resolvePresenceParticipants } from "./presenceParticipants";

interface TownPresenceState {
  participants: PresenceParticipant[];
  groupedParticipants: Partial<Record<VillageId, PresenceParticipant[]>>;
  isConnected: boolean;
  lastSyncedAt?: string;
  localJoinedAt: string;
  previousUserIds: Set<string>;
  isAwaitingInitialJoin: boolean;
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

  setParticipants: (participants: PresenceParticipant[], currentUserId: string) => void;
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

export const useTownPresenceStore = create<TownPresenceState>((set, get) => {
  /**
   * 가장 최근에 setParticipants()로 들어온 원본(raw) presence 스냅샷의 userId 집합이다.
   * store의 participants는 departure grace 동안 이탈 후보를 계속 표시(retain)하므로,
   * "지금 실제로 존재하는가"를 판단하려면 store가 아니라 이 원본 스냅샷을 봐야 한다 —
   * get().participants를 쓰면 보류 중인 유저가 항상 "존재함"으로 판정되는 순환 오류가 생긴다.
   */
  let latestRawSnapshotUserIds = new Set<string>();

  /**
   * 이탈 확정 유예(grace) 정책. Movement의 remote player 제거와 동일한 shared 정책을 쓴다
   * (shared/lib/realtime/departureGrace.ts). town:main 채널이 재연결 중일 때 grace가
   * 만료되면 즉시 확정하지 않고, 신선한 presence 스냅샷이 도착할 때(reconcile) 재검증한다.
   */
  const departureController = createDepartureGraceController({
    graceMs: DEPARTURE_GRACE_MS,
    isChannelReconnecting: () => getTownChannelStatus(TOWN_MAIN_CHANNEL) !== "SUBSCRIBED",
    isPresentInSnapshot: (userId) => latestRawSnapshotUserIds.has(userId),
    onConfirmed: (userId) => {
      const latestState = get();
      const departedParticipant = latestState.participants.find((p) => p.userId === userId);
      const nextParticipants = latestState.participants.filter((p) => p.userId !== userId);

      if (departedParticipant) {
        toast(`${departedParticipant.nickname} 퇴장했습니다.`, { duration: 3000 });
      }

      set({
        participants: nextParticipants,
        groupedParticipants: groupParticipantsByVillage(nextParticipants),
        lastSyncedAt: new Date().toISOString(),
        previousUserIds: new Set(nextParticipants.map((p) => p.userId)),
      });
    },
  });

  return {
    participants: [],
    groupedParticipants: {},
    isConnected: false,
    lastSyncedAt: undefined,
    localJoinedAt: new Date().toISOString(),
    previousUserIds: new Set(),
    isAwaitingInitialJoin: true,
    voiceConnected: false,
    audioEnabled: false,
    canToggleAudio: false,
    toggleLocalAudio: null,
    isAudioToggling: false,
    canToggleListening: false,
    listeningEnabled: true,
    toggleLocalListening: null,

    setParticipants: (participants, currentUserId) => {
      latestRawSnapshotUserIds = new Set(participants.map((p) => p.userId));

      const state = get();
      const resolvedParticipants = resolvePresenceParticipants({
        currentUserId,
        isAwaitingInitialJoin: state.isAwaitingInitialJoin,
        nextParticipants: participants,
        pendingDepartureUserIds: departureController.getPendingIds(),
        previousParticipants: state.participants,
        previousUserIds: state.previousUserIds,
      });

      resolvedParticipants.recoveredPendingDepartureUserIds.forEach((userId) => {
        departureController.cancel(userId);
      });

      resolvedParticipants.departureCandidates.forEach((previousParticipant) => {
        departureController.schedule(previousParticipant.userId);
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
          isAwaitingInitialJoin: false,
        });

        departureController.reconcile();
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
      });

      // 신선한 presence 스냅샷이 반영된 뒤, 재연결 중이라 확정을 보류해뒀던 이탈을 재검증한다.
      departureController.reconcile();
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
      departureController.cancelAll();

      set({
        participants: [],
        groupedParticipants: {},
        isConnected: false,
        lastSyncedAt: undefined,
        previousUserIds: new Set(),
        isAwaitingInitialJoin: true,
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
  };
});
