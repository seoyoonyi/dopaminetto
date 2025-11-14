"use client";

import { ChatHistory } from "@/features/chat";
import { MessageField } from "@/features/chat";
import { useUserStore } from "@/shared/store";

import { useState } from "react";

interface MessageState {
  user: string;
  text: string;
  timestamp: Date;
}

const MAX_MESSAGES = 20;

export default function TownPage() {
  const { userNickname } = useUserStore();
  const [messages, setMessages] = useState<MessageState[]>([]);

  const handleMessageSend = (message: string) => {
    setMessages((prev) => {
      const updated = [
        ...prev,
        {
          user: userNickname,
          text: message,
          timestamp: new Date(),
        },
      ];

      return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
    });
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 메인 콘텐츠 영역 */}
      <div className="flex flex-1 min-h-0">
        {/* Map 컴포넌트가 들어올 예정 */}
        <div className="flex-1"></div>

        <div className="flex flex-col w-96 h-full">
          <ChatHistory userNickname={userNickname} messages={messages} />
          <MessageField channelType="public" onMessageSend={handleMessageSend} />
        </div>
      </div>

      {/* 하단 바 컴포넌트가 들어올 예정 */}
      <div className="w-full h-10 bg-gray-100"></div>
    </div>
  );
}
