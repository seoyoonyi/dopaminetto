"use client";

import { ChatHistory, MessageField } from "@/features/chat";

import { useChatPanel } from "../model/useChatPanel";

interface ChatPanelProps {
  userNickname: string;
}

export function ChatPanel({ userNickname }: ChatPanelProps) {
  const { messages, handleMessageSend, isConnected } = useChatPanel();

  return (
    <>
      <ChatHistory currentUserNickname={userNickname} messages={messages} />
      <MessageField
        channelType="public"
        onMessageSend={handleMessageSend}
        isConnected={isConnected}
      />
    </>
  );
}

export default ChatPanel;
