"use client";

import { useTownPresenceView } from "@/features/presence/model/useTownPresence";
import { hasMultipleDates, isSameUserContinuous } from "@/shared/lib";
import { formatDate, formatTime, isSameDay } from "@/shared/lib";

import { useEffect, useRef, useState } from "react";

import { Message } from "../types";

interface ChatHistoryProps {
  messages: Message[];
  currentUserNickname: string;
}

interface SystemMessage {
  id: string;
  type: "join" | "leave";
  nickname: string;
  timestamp: string;
}

type TimelineItem = { type: "message"; data: Message } | { type: "system"; data: SystemMessage };

export default function ChatHistory({ messages, currentUserNickname }: ChatHistoryProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { participants } = useTownPresenceView();

  const trackedParticipantsRef = useRef<Set<string> | null>(null);
  const isInitialPresenceSyncRef = useRef(true);

  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);

  useEffect(() => {
    const currentNicknames = participants.map((p) => p.nickname);
    const currentSet = new Set(currentNicknames);
    const trackedSet = trackedParticipantsRef.current;

    if (isInitialPresenceSyncRef.current) {
      if (!currentNicknames.includes(currentUserNickname)) {
        return;
      }

      isInitialPresenceSyncRef.current = false;
      trackedParticipantsRef.current = new Set(currentSet);

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSystemMessages((prev) => [
        ...prev,
        {
          id: `join-${currentUserNickname}-${Date.now()}`,
          type: "join",
          nickname: currentUserNickname,
          timestamp: new Date().toISOString(),
        },
      ]);

      return;
    }

    if (!trackedSet) {
      trackedParticipantsRef.current = new Set(currentSet);
      return;
    }

    const newJoins: string[] = [];
    const leaves: string[] = [];

    currentSet.forEach((nickname) => {
      if (!trackedSet.has(nickname)) {
        newJoins.push(nickname);
        trackedSet.add(nickname);
      }
    });

    trackedSet.forEach((nickname) => {
      if (!currentSet.has(nickname)) {
        leaves.push(nickname);
        trackedSet.delete(nickname);
      }
    });

    if (newJoins.length === 0 && leaves.length === 0) {
      return;
    }

     
    setSystemMessages((prev) => [
      ...prev,
      ...newJoins.map<SystemMessage>((nickname) => ({
        id: `join-${nickname}-${Date.now()}`,
        type: "join",
        nickname,
        timestamp: new Date().toISOString(),
      })),
      ...leaves.map<SystemMessage>((nickname) => ({
        id: `leave-${nickname}-${Date.now()}`,
        type: "leave",
        nickname,
        timestamp: new Date().toISOString(),
      })),
    ]);
  }, [participants, currentUserNickname]);

  const shouldShowDateDividers = hasMultipleDates(messages);

  const mergedItems: TimelineItem[] = [
    ...messages.map<TimelineItem>((msg) => ({ type: "message", data: msg })),
    ...systemMessages.map<TimelineItem>((sys) => ({ type: "system", data: sys })),
  ];

  const allItems = mergedItems.sort(
    (a, b) => new Date(a.data.timestamp).getTime() - new Date(b.data.timestamp).getTime(),
  );

  const seenUsers = new Set<string>();

  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;

    const AUTO_SCROLL_THRESHOLD_PX = 80;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;

    const isNearBottom = distanceToBottom < AUTO_SCROLL_THRESHOLD_PX;

    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, systemMessages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-3 py-2 text-sm font-semibold">채팅</div>

      <div className="flex flex-col flex-1 overflow-y-auto p-3 text-sm">
        {allItems.map((item, index) => {
          if (item.type === "system") {
            const sys = item.data;
            const prevItem = index > 0 ? allItems[index - 1] : undefined;

            const showDateDivider =
              shouldShowDateDividers &&
              (index === 0 || (prevItem && !isSameDay(prevItem.data.timestamp, sys.timestamp)));

            return (
              <div key={sys.id}>
                {showDateDivider && (
                  <div
                    role="separator"
                    aria-label={`날짜: ${formatDate(sys.timestamp)}`}
                    className="my-4 flex items-center gap-3"
                  >
                    <div className="h-px flex-1 bg-gray-300" />
                    <span className="px-2 text-xs text-gray-400" aria-hidden="true">
                      {formatDate(sys.timestamp)}
                    </span>
                    <div className="h-px flex-1 bg-gray-300" />
                  </div>
                )}

                <div
                  role="status"
                  aria-live="polite"
                  className="my-2 text-center text-xs text-gray-400"
                >
                  {sys.nickname} {sys.type === "join" ? "입장했습니다." : "퇴장했습니다."}
                </div>
              </div>
            );
          }

          const msg = item.data;
          const prevItem = index > 0 ? allItems[index - 1] : undefined;
          const prevMsg = prevItem?.type === "message" ? (prevItem.data as Message) : undefined;

          const showDateDivider =
            shouldShowDateDividers &&
            (index === 0 || (prevItem && !isSameDay(prevItem.data.timestamp, msg.timestamp)));

          const isContinuous = isSameUserContinuous(msg, prevMsg);

          const showUserEntry = !seenUsers.has(msg.user);
          if (showUserEntry) {
            seenUsers.add(msg.user);
          }

          return (
            <div key={`${msg.user}-${msg.timestamp}-${index}`}>
              {showDateDivider && (
                <div
                  role="separator"
                  aria-label={`날짜: ${formatDate(msg.timestamp)}`}
                  className="my-4 flex items-center gap-3"
                >
                  <div className="h-px flex-1 bg-gray-300" />
                  <span className="px-2 text-xs text-gray-400">{formatDate(msg.timestamp)}</span>
                  <div className="h-px flex-1 bg-gray-300" />
                </div>
              )}

              <div className={`flex gap-2 ${isContinuous ? "mb-1" : "mb-3"}`}>
                <div className="flex-shrink-0">
                  {!isContinuous ? (
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-xs font-semibold text-gray-600"
                      role="img"
                      aria-label={`${msg.user}의 프로필`}
                    >
                      {msg.user.charAt(0)}
                    </div>
                  ) : (
                    <div className="h-8 w-8" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {!isContinuous && (
                    <div className="mb-1 flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-900">{msg.user}</span>
                      <span className="text-xs text-gray-400">{formatTime(msg.timestamp)}</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words text-sm text-gray-800">
                    {msg.text}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
