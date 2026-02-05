"use client";

import { ChatHistory, MessageField } from "@/features/chat";

import { useChatPanel } from "../model/useChatPanel";

export function ChatPanel() {
  const {
    messages,
    data,
    handleMessageSend,
    isConnected,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    onVisiblePagesUpdate,
  } = useChatPanel();

  return (
    <>
      <ChatHistory
        messages={messages}
        data={data}
        onLoadMore={fetchNextPage}
        hasMore={hasNextPage}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        onVisiblePagesUpdate={onVisiblePagesUpdate}
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
