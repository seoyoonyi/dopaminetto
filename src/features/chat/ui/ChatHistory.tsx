"use client";

import { hasMultipleDates, isSameDay } from "@/shared/lib";

import { useEffect, useRef } from "react";

import { Message } from "../types";
import { ChatMessageItem } from "./ChatMessageItem";
import { DateDivider } from "./DateDivider";

interface ChatHistoryProps {
  messages: Message[];
}

export default function ChatHistory({ messages }: ChatHistoryProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldShowDateDividers = hasMultipleDates(messages);

  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
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
  }, [messages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-3 py-2 text-sm font-semibold">채팅</div>

      <div className="flex flex-col flex-1 overflow-y-auto p-3 text-sm">
        {sortedMessages.map((message, index) => {
          const prevMessage = index > 0 ? sortedMessages[index - 1] : undefined;

          const showDateDivider =
            shouldShowDateDividers &&
            (index === 0 ||
              (prevMessage && !isSameDay(prevMessage.created_at, message.created_at)));

          return (
            <div key={`message-${message.id}`}>
              {showDateDivider && <DateDivider created_at={message.created_at} />}
              <ChatMessageItem message={message} previousMessage={prevMessage} />
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
