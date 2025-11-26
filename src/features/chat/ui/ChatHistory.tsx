"use client";

import { useTownPresenceStore } from "@/features/presence/model/useTownPresenceStore";
import { hasMultipleDates, isSameDay } from "@/shared/lib";

import { useEffect, useRef } from "react";

import { ChatMessage, SystemMessage } from "../types";
import { ChatMessageItem } from "./ChatMessageItem";
import { DateDivider } from "./DateDivider";
import { SystemMessageItem } from "./SystemMessageItem";

interface ChatHistoryProps {
  messages: ChatMessage[];
}

type TimelineItem =
  | { type: "message"; data: ChatMessage }
  | { type: "system"; data: SystemMessage };

export default function ChatHistory({ messages }: ChatHistoryProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const systemMessages = useTownPresenceStore((state) => state.systemMessages);

  const shouldShowDateDividers = hasMultipleDates(messages);

  const mergedItems: TimelineItem[] = [
    ...messages.map<TimelineItem>((msg) => ({ type: "message", data: msg })),
    ...systemMessages.map<TimelineItem>((sys) => ({ type: "system", data: sys })),
  ];

  const allItems = mergedItems.sort(
    (a, b) => new Date(a.data.created_at).getTime() - new Date(b.data.created_at).getTime(),
  );

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
          const prevItem = index > 0 ? allItems[index - 1] : undefined;

          const showDateDivider =
            shouldShowDateDividers &&
            (index === 0 ||
              (prevItem && !isSameDay(prevItem.data.created_at, item.data.created_at)));

          const prevMsg = prevItem?.type === "message" ? (prevItem.data as ChatMessage) : undefined;

          return (
            <div key={`${item.type}-${item.data.created_at}-${index}`}>
              {showDateDivider && <DateDivider created_at={item.data.created_at} />}

              {item.type === "system" ? (
                <SystemMessageItem message={item.data as SystemMessage} />
              ) : (
                <ChatMessageItem message={item.data as ChatMessage} previousMessage={prevMsg} />
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
