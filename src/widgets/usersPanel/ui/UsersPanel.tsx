"use client";

import { VILLAGES, VillageId } from "@/entities/village";
import { useTownPresenceStore } from "@/features/presence/model/useTownPresenceStore";
import { PresenceParticipant } from "@/features/presence/types";
import { formatJoinedTime } from "@/shared/lib";
import { useShallow } from "zustand/react/shallow";

export function UsersPanel() {
  const { groupedParticipants, participantCount, isConnected } = useTownPresenceStore(
    useShallow((state) => ({
      groupedParticipants: state.groupedParticipants,
      participantCount: state.participants.length,
      isConnected: state.isConnected,
    })),
  );
  const presenceStatus = isConnected ? "실시간으로 동기화 중" : "연결 대기 중";
  const presenceIndicatorLabel = isConnected ? "Presence 연결됨" : "Presence 연결 대기";

  const villageIds = Object.keys(VILLAGES) as VillageId[];

  const renderParticipantList = (list: PresenceParticipant[]) => {
    return list.map((participant) => (
      <div
        key={participant.presenceRef}
        className="flex items-center justify-between px-4 py-2 text-sm hover:bg-gray-50"
      >
        <div className="flex flex-col">
          <span className="font-medium text-gray-900">{participant.nickname}</span>
          <span className="text-xs text-gray-500">{formatJoinedTime(participant.joinedAt)}</span>
        </div>
        <span className="text-xs text-gray-400 font-mono">{participant.userId.slice(0, 4)}</span>
      </div>
    ));
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
