"use client";

import { ChatHistory, MessageField } from "@/features/chat";

// 로직(훅)을 임포트합니다.
import { useChatPanel } from "../model/useChatPanel";

export function ChatPanel() {
  // 훅을 호출하여 로직과 상태를 가져옵니다.
  const { userNickname, messages, handleMessageSend, isConnected } = useChatPanel();

  // 닉네임이 없으면(Zustand에 설정 전) 아무것도 렌더링하지 않습니다.
  if (!userNickname) {
    return null; // 또는 "닉네임을 설정해주세요" UI
  }

  return (
    <div className="p-6 bg-gray-200 h-screen w-80">
      {/* features/chat/ui에서 가져온 컴포넌트 */}
      <ChatHistory userNickname={userNickname} messages={messages} />
      <MessageField channelType="public" onMessageSend={handleMessageSend} />
      <hr className="my-4" />
    </div>
  );
}

export default ChatPanel;
