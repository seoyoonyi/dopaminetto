"use client";

import { formatTime, isSameUserContinuous } from "@/shared/lib";

import { Message } from "../types";
import { LinkifiedText } from "./LinkifiedText";

interface ChatMessageItemProps {
  message: Message;
  previousMessage?: Message;
}

export function ChatMessageItem({ message, previousMessage }: ChatMessageItemProps) {
  const isContinuous = isSameUserContinuous(message, previousMessage);

  return (
    <div className={`flex gap-2 ${isContinuous ? "mb-1" : "mb-3"}`}>
      <div className="flex-shrink-0">
        {!isContinuous ? (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-xs font-semibold text-gray-600"
            role="img"
            aria-label={`${message.user}의 프로필`}
          >
            {message.user.charAt(0)}
          </div>
        ) : (
          <div className="h-8 w-8" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {!isContinuous && (
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-sm font-medium text-gray-900">{message.user}</span>
            <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
          </div>
        )}
        <div className="whitespace-pre-wrap break-words text-sm text-gray-800">
          <LinkifiedText text={message.text} />
        </div>
      </div>
    </div>
  );
}
