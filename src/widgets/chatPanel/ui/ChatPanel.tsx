"use client";

import { ChatHistory, MessageField } from "@/features/chat";

import { useChatPanel } from "../model/useChatPanel";

export function ChatPanel() {
  const {
    messages,
    handleMessageSend,
    isConnected,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
  } = useChatPanel();

  return (
    <>
      <ChatHistory
        messages={messages}
        onLoadMore={fetchNextPage}
        hasMore={hasNextPage}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
      />
      <MessageField
        channelType="public"
        onMessageSend={handleMessageSend}
        isConnected={isConnected}
      />
    </>
  );
}

export default ChatPanel;
