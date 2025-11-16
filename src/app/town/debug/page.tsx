"use client";

import { useTownPresence } from "@/features/presence";

export default function TownPresenceDebugPage() {
  const { participants, isConnected } = useTownPresence();

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">타운 Presence 디버그</h1>
      <div>
        상태:{" "}
        <span className={isConnected ? "text-green-600" : "text-red-600"}>
          {isConnected ? "연결됨" : "연결 끊김"}
        </span>
      </div>
      <div className="border rounded p-4">
        <h2 className="font-medium mb-2">접속자 목록</h2>
        {participants.length === 0 ? (
          <p className="text-sm text-gray-500">현재 접속자가 없습니다.</p>
        ) : (
          <ul className="space-y-1">
            {participants.map((participant) => (
              <li
                key={participant.presenceRef}
                className="flex items-center justify-between text-sm"
              >
                <span>{participant.nickname}</span>
                {participant.joinedAt && (
                  <span className="text-gray-500">
                    {new Date(participant.joinedAt).toLocaleTimeString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
