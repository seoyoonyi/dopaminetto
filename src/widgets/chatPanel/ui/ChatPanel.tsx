"use client";

import { ChatHistory, MessageField } from "@/features/chat";

import { useChatPanel } from "../model/useChatPanel";

export function ChatPanel() {
  const { messages, handleMessageSend, isConnected } = useChatPanel();

  return (
    <>
      <ChatHistory messages={messages} />
      <MessageField
        channelType="public"
        onMessageSend={handleMessageSend}
        isConnected={isConnected}
      />
    </>
  );
}

export default ChatPanel;
