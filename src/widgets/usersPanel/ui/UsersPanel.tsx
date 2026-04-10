"use client";

import { VILLAGES, VillageId } from "@/entities/village";
import { useTownPresenceStore } from "@/features/presence/model/useTownPresenceStore";
import { PresenceParticipant } from "@/features/presence/types";
import { useUserInfo } from "@/shared/hooks";
import { formatJoinedTime } from "@/shared/lib";
import { Headphones, Mic } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

/**
 * 다른 사용자의 음성 상태를 나타내는 아이콘을 렌더링한다.
 *
 * 발표자는 마이크가 활성화되었을 때 초록색 마이크 아이콘을 표시하고,
 * 청취자는 음성 채널에 연결되었을 때 초록색 헤드셋 아이콘을 표시한다.
 */
const renderVoiceIndicator = (participant: PresenceParticipant) => {
  if (participant.isSpeaker) {
    if (!participant.audioEnabled) {
      return null;
    }

    return (
      <span
        className="inline-flex items-center text-emerald-500"
        aria-label="발표 중"
        title="발표 중"
      >
        <Mic className="size-3.5" aria-hidden="true" />
      </span>
    );
  }

  if (!participant.voiceConnected) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center text-emerald-500"
      aria-label="청취 중"
      title="청취 중"
    >
      <Headphones className="size-3.5" aria-hidden="true" />
    </span>
  );
};

/**
 * 현재 사용자 row는 presence 재동기화보다 로컬 음성 상태를 우선 사용해
 * 아이콘이 즉시 반응하도록 한다.
 */
const getResolvedParticipant = (
  participant: PresenceParticipant,
  currentUserId: string | undefined,
  localVoiceConnected: boolean,
  localAudioEnabled: boolean,
) => {
  if (participant.userId !== currentUserId) {
    return participant;
  }

  return {
    ...participant,
    voiceConnected: localVoiceConnected,
    audioEnabled: localAudioEnabled,
  };
};

/**
 * 발표자인 현재 사용자의 마이크 토글 버튼을 렌더링한다.
 */
const renderSpeakerControl = (audioEnabled: boolean | undefined, onToggle: () => Promise<void>) => (
  <button
    type="button"
    onClick={() => void onToggle()}
    className={`inline-flex cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
      audioEnabled ? "text-emerald-500 hover:text-emerald-600" : "text-gray-300 hover:text-gray-500"
    }`}
    aria-label={audioEnabled ? "마이크 끄기" : "마이크 켜기"}
    aria-pressed={audioEnabled}
    title={audioEnabled ? "마이크 끄기" : "마이크 켜기"}
  >
    <Mic className="size-3.5" aria-hidden="true" />
  </button>
);

/**
 * 청취자인 현재 사용자의 청취 토글 버튼을 렌더링한다.
 */
const renderListenerControl = (listeningEnabled: boolean, onToggle: () => Promise<void>) => (
  <button
    type="button"
    onClick={() => void onToggle()}
    className={`inline-flex cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
      listeningEnabled
        ? "text-emerald-500 hover:text-emerald-600"
        : "text-gray-300 hover:text-gray-500"
    }`}
    aria-label={listeningEnabled ? "청취 끄기" : "청취 켜기"}
    aria-pressed={listeningEnabled}
    title={listeningEnabled ? "청취 끄기" : "청취 켜기"}
  >
    <Headphones className="size-3.5" aria-hidden="true" />
  </button>
);

export function UsersPanel() {
  const { data: user } = useUserInfo();
  const {
    groupedParticipants,
    participantCount,
    isConnected,
    localVoiceConnected,
    localAudioEnabled,
    canToggleAudio,
    toggleLocalAudio,
    canToggleListening,
    localListeningEnabled,
    toggleLocalListening,
  } = useTownPresenceStore(
    useShallow((state) => ({
      groupedParticipants: state.groupedParticipants,
      participantCount: state.participants.length,
      isConnected: state.isConnected,
      localVoiceConnected: state.voiceConnected,
      localAudioEnabled: state.audioEnabled,
      canToggleAudio: state.canToggleAudio,
      toggleLocalAudio: state.toggleLocalAudio,
      canToggleListening: state.canToggleListening,
      localListeningEnabled: state.listeningEnabled,
      toggleLocalListening: state.toggleLocalListening,
    })),
  );
  const presenceStatus = isConnected ? "실시간으로 동기화 중" : "연결 대기 중";
  const presenceIndicatorLabel = isConnected ? "Presence 연결됨" : "Presence 연결 대기";
  const currentUserId = user?.id;

  const villageIds = Object.keys(VILLAGES) as VillageId[];

  const renderParticipantList = (list: PresenceParticipant[]) => {
    return list.map((participant) => {
      const resolvedParticipant = getResolvedParticipant(
        participant,
        currentUserId,
        localVoiceConnected,
        localAudioEnabled,
      );
      const isCurrentUser = resolvedParticipant.userId === currentUserId;
      const voiceControl = (() => {
        if (!isCurrentUser) return renderVoiceIndicator(resolvedParticipant);
        if (resolvedParticipant.isSpeaker) {
          if (!canToggleAudio || !toggleLocalAudio) return null;
          return renderSpeakerControl(resolvedParticipant.audioEnabled, toggleLocalAudio);
        }
        if (!canToggleListening || !toggleLocalListening) return null;
        return renderListenerControl(localListeningEnabled, toggleLocalListening);
      })();

      return (
        <div
          key={resolvedParticipant.presenceRef}
          className="flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50"
        >
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium text-gray-900">
                {resolvedParticipant.nickname}
              </span>
              {voiceControl}
            </div>
            <span className="text-xs text-gray-500">
              {formatJoinedTime(resolvedParticipant.joinedAt)}
            </span>
          </div>
          <span className="font-mono text-xs text-gray-400">
            {resolvedParticipant.userId.slice(0, 4)}
          </span>
        </div>
      );
    });
  };

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3 bg-gray-50/50">
        <div>
          <p className="text-sm font-semibold text-gray-900">접속자 {participantCount}명</p>
          <p className="text-xs text-gray-500">{presenceStatus}</p>
        </div>
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isConnected
              ? "bg-emerald-500 shadow-sm shadow-emerald-200"
              : "bg-amber-400 animate-pulse"
          }`}
          aria-label={presenceIndicatorLabel}
        />
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {participantCount === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500 flex-col gap-2">
            <span className="text-2xl">👻</span>
            <span>아직 아무도 없어요</span>
          </div>
        ) : (
          <>
            {villageIds.map((vId) => {
              const list = groupedParticipants[vId] || [];
              if (list.length === 0) return null;
              const config = VILLAGES[vId as keyof typeof VILLAGES];

              return (
                <div key={vId} className="flex flex-col">
                  <div className="bg-gray-100/80 px-4 py-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky top-0 backdrop-blur-sm border-b border-gray-200/50">
                    {config.name} ({list.length})
                  </div>
                  <div className="divide-y divide-gray-50">{renderParticipantList(list)}</div>
                </div>
              );
            })}
          </>
        )}
        {/* TODO(Phase3): Presence 역할/음성 상태 등의 추가 메타데이터를 노출하고 필터링 UI를 확장한다. */}
      </div>
    </div>
  );
}

export default UsersPanel;
