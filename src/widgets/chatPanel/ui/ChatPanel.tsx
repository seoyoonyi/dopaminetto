"use client";

import { ChatHistory, MessageField } from "@/features/chat";

import { useChatPanel } from "../model/useChatPanel";

export function ChatPanel() {
  const {
    userId,
    messages,
    data,
    handleMessageSend,
    isConnected,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    onVisiblePagesUpdate,
    roomId,
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
        currentUserId={userId}
      />
      <MessageField
        channelType="public"
        onMessageSend={handleMessageSend}
        isConnected={isConnected}
        roomId={roomId}
      />
    </>
  );
}

export default ChatPanel;
