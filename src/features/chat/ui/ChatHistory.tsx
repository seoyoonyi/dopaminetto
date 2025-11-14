"use client";

import { useEffect, useRef } from "react";

interface Message {
  user: string;
  text: string;
  timestamp: Date;
}

interface ChatHistoryProps {
  userNickname: string;
  messages: Message[];
}

export default function ChatHistory({ userNickname, messages }: ChatHistoryProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-3 py-2 text-sm font-semibold">채팅</div>
      <div className="flex-1 overflow-y-auto p-3 text-sm flex flex-col">
        <div className="mb-3 text-center text-xs text-gray-400">{userNickname} 입장했습니다.</div>

        {messages.map((msg) => (
          <div key={`${msg.user}-${msg.timestamp.getTime()}`} className="mb-3 flex gap-2">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600">
                {msg.user.charAt(0)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-gray-900 text-sm">{msg.user}</span>
                <span className="text-gray-400 text-xs">{formatTime(msg.timestamp)}</span>
              </div>
              <div className="text-gray-800 break-words mt-0.5 whitespace-pre-wrap text-sm">
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
