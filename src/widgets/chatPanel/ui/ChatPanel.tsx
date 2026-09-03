"use client";

import { VILLAGES } from "@/entities/village";
import { ChatHistory, MessageField } from "@/features/chat";

import { useChatPanel } from "../model/useChatPanel";
import { ChatPanelHeader } from "./ChatPanelHeader";

export function ChatPanel() {
  const {
    userId,
    messages,
    data,
    handleMessageSend,
    isConnected,
    canSendMessage,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    onVisiblePagesUpdate,
    roomId,
    villageId,
  } = useChatPanel();

  const villageName = VILLAGES[villageId as keyof typeof VILLAGES]?.name ?? villageId;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChatPanelHeader villageName={villageName} isConnected={isConnected} />
      <ChatHistory
        key={roomId}
        messages={messages}
        data={data}
        onLoadMore={fetchNextPage}
        hasMore={hasNextPage}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        onVisiblePagesUpdate={onVisiblePagesUpdate}
        currentUserId={userId}
      />
      <MessageField onMessageSend={handleMessageSend} canSend={canSendMessage} roomId={roomId} />
    </div>
  );
}

export default ChatPanel;
