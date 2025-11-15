"use client";

import { ChatHistory, MessageField } from "@/features/chat";

import { useChatPanel } from "../model/useChatPanel";

export function ChatPanel() {
  const { userNickname, messages, handleMessageSend, isConnected } = useChatPanel();

  if (!userNickname) {
    return null;
  }

  return (
    <>
      <ChatHistory userNickname={userNickname} messages={messages} />
      <MessageField
        channelType="public"
        onMessageSend={handleMessageSend}
        isConnected={isConnected}
      />
    </>
  );
}

export default ChatPanel;
