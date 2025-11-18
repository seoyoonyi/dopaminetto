"use client";

import { hasMultipleDates, isSameUserContinuous } from "@/shared/lib";
import { formatDate, formatTime, isSameDay } from "@/shared/lib";

import { useEffect, useRef } from "react";

import { Message } from "../types";

interface ChatHistoryProps {
  messages: Message[];
}

export default function ChatHistory({ messages }: ChatHistoryProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;

    const threshold = 80;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold;

    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const shouldShowDateDividers = hasMultipleDates(messages);
  const seenUsers = new Set<string>();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-3 py-2 text-sm font-semibold">채팅</div>

      <div className="flex flex-col flex-1 overflow-y-auto p-3 text-sm">
        {messages.map((msg, index) => {
          const prevMsg = index > 0 ? messages[index - 1] : undefined;

          const showDateDivider =
            shouldShowDateDividers &&
            (index === 0 || (prevMsg && !isSameDay(prevMsg.timestamp, msg.timestamp)));

          const isContinuous = isSameUserContinuous(msg, prevMsg);

          const showUserEntry = !seenUsers.has(msg.user);
          if (showUserEntry) {
            seenUsers.add(msg.user);
          }

          return (
            <div key={`${msg.user}-${msg.timestamp}-${index}`}>
              {showDateDivider && (
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-300" />
                  <span className="px-2 text-xs text-gray-400">{formatDate(msg.timestamp)}</span>
                  <div className="h-px flex-1 bg-gray-300" />
                </div>
              )}

              {showUserEntry && (
                <div className="my-2 text-center text-xs text-gray-400">
                  {msg.user} 입장했습니다.
                </div>
              )}

              <div className={`flex gap-2 ${isContinuous ? "mb-1" : "mb-3"}`}>
                <div className="flex-shrink-0">
                  {!isContinuous ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-xs font-semibold text-gray-600">
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
