"use client";

import { useTownPresenceStore } from "@/features/presence/model/useTownPresenceStore";

const joinedTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
});

const formatJoinedTime = (joinedAt?: string) => {
  if (!joinedAt) {
    return "입장 시각 확인 중";
  }

  const joinedDate = new Date(joinedAt);
  if (Number.isNaN(joinedDate.getTime())) {
    return "입장 시각 확인 중";
  }

  return joinedTimeFormatter.format(joinedDate);
};

export function UsersPanel() {
  const participants = useTownPresenceStore((state) => state.participants);
  const isConnected = useTownPresenceStore((state) => state.isConnected);
  const participantCount = participants.length;
  const presenceStatus = isConnected ? "실시간으로 동기화 중" : "연결 대기 중";
  const presenceIndicatorLabel = isConnected ? "Presence 연결됨" : "Presence 연결 대기";

  return (
    <div className="flex h-full w-full flex-col bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">사용자 {participantCount}명</p>
          <p className="text-xs text-gray-500">{presenceStatus}</p>
        </div>
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isConnected ? "bg-emerald-500" : "bg-amber-400 animate-pulse"
          }`}
          aria-label={presenceIndicatorLabel}
        />
      </div>

      <div className="flex-1 overflow-y-auto divide-y">
        {participantCount === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            접속 중인 사용자가 없습니다.
          </div>
        ) : (
          participants.map((participant) => (
            <div
              key={participant.presenceRef}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium text-gray-900">
                  {participant.nickname || "닉네임 미지정"}
                </span>
                <span className="text-xs text-gray-500">
                  입장 {formatJoinedTime(participant.joinedAt)}
                </span>
              </div>
              <span className="text-xs text-gray-400">{participant.userId.slice(0, 8)}</span>
            </div>
          ))
        )}
        {/* TODO(Phase3): Presence 역할/음성 상태 등의 추가 메타데이터를 노출하고 필터링 UI를 확장한다. */}
      </div>
    </div>
  );
}

export default UsersPanel;
