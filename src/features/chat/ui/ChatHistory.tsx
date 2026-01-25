"use client";

import { ChatMessageSkeletonList } from "@/features/chat/ui/ChatMessageSkeletonList";
import { useIntersectionObserver } from "@/shared/hooks/useIntersectionObserver";
import { useVisiblePageTracking } from "@/shared/hooks/useVisiblePageTracking";
import { hasMultipleDates, isSameDay } from "@/shared/lib";
import { InfiniteData } from "@tanstack/react-query";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Message, MessagesPage } from "../types";
import { ChatMessageItem } from "./ChatMessageItem";
import { DateDivider } from "./DateDivider";

interface ChatHistoryProps {
  messages: Message[];
  data?: InfiniteData<MessagesPage>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  onVisiblePagesUpdate?: (pageIndices: Set<number>) => void;
}

const MESSAGE_HEIGHT = 60;
const DEFAULT_SKELETON_COUNT = 10;

export default function ChatHistory({
  messages,
  data,
  onLoadMore,
  hasMore,
  isLoading,
  isFetchingNextPage,
  onVisiblePagesUpdate,
}: ChatHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const prevScrollHeight = useRef<number>(0);
  const prevScrollTop = useRef<number>(0);

  const [skeletonCount, setSkeletonCount] = useState(DEFAULT_SKELETON_COUNT);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const sortedMessages = [...messages].sort((a, b) => {
    if (a.id < 0 && b.id >= 0) return 1;
    if (a.id >= 0 && b.id < 0) return -1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // 각 메시지가 속한 페이지 인덱스 계산
  const messagesWithPageIndex = useMemo(() => {
    if (!data?.pages) {
      return sortedMessages.map((msg) => ({ ...msg, pageIndex: -1 }));
    }

    return sortedMessages.map((msg) => {
      const pageIndex = data.pages.findIndex((page) => page.messages.some((m) => m.id === msg.id));
      return { ...msg, pageIndex };
    });
  }, [data, sortedMessages]);

  const shouldShowDateDividers = hasMultipleDates(messages);

  // 보이는 페이지 추적
  const handleVisiblePagesChange = useCallback(
    (pageIndices: Set<number>) => {
      onVisiblePagesUpdate?.(pageIndices);
    },
    [onVisiblePagesUpdate],
  );

  const observerRef = useVisiblePageTracking(handleVisiblePagesChange);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || isLoading || isFetchingNextPage) return;

    const container = containerRef.current;
    if (container) {
      prevScrollHeight.current = container.scrollHeight;
      prevScrollTop.current = container.scrollTop;
    }

    onLoadMore?.();
  }, [hasMore, isLoading, onLoadMore, isFetchingNextPage]);

  const topObserverRef = useIntersectionObserver<HTMLDivElement>(handleLoadMore, {
    rootMargin: "100px",
  });

  useEffect(() => {
    if (!isFirstRender.current) return;
    if (sortedMessages.length === 0) return;

    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    isFirstRender.current = false;
  }, [sortedMessages]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 5;
      setIsAtBottom(atBottom);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isAtBottom) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAtBottom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSkeletonCount = () => {
      const count = Math.ceil(container.clientHeight / MESSAGE_HEIGHT);
      setSkeletonCount(count);
    };

    updateSkeletonCount();

    const resizeObserver = new ResizeObserver(updateSkeletonCount);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isFirstRender.current) return;

    if (prevScrollHeight.current > 0 && !isFetchingNextPage) {
      const newScrollHeight = container.scrollHeight;
      const scrollDiff = newScrollHeight - prevScrollHeight.current;

      container.scrollTop = prevScrollTop.current + scrollDiff;
      prevScrollHeight.current = 0;
      prevScrollTop.current = 0;
    }
  }, [messages, isFetchingNextPage]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-3 py-2 text-sm font-semibold">채팅</div>

      <div ref={containerRef} className="flex flex-1 flex-col overflow-y-auto p-3 text-sm">
        {isLoading ? (
          <ChatMessageSkeletonList count={skeletonCount} />
        ) : sortedMessages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            대화를 시작해보세요!
          </div>
        ) : (
          <>
            {hasMore && <div ref={topObserverRef} className="h-1" />}
            {isFetchingNextPage && <ChatMessageSkeletonList count={skeletonCount} />}
            {messagesWithPageIndex.map((message, index) => {
              const prevMessage = index > 0 ? messagesWithPageIndex[index - 1] : undefined;
              const isFirstMessage = index === 0;
              const isDifferentDay =
                prevMessage && !isSameDay(prevMessage.created_at, message.created_at);

              const showDateDivider =
                shouldShowDateDividers && ((isFirstMessage && !isLoading) || isDifferentDay);

              return (
                <div
                  key={`message-${message.id}`}
                  ref={(node) => {
                    if (node && message.pageIndex >= 0) {
                      observerRef.current?.observe(node);
                    }
                  }}
                  data-page-index={message.pageIndex}
                >
                  {showDateDivider && <DateDivider created_at={message.created_at} />}
                  <ChatMessageItem message={message} previousMessage={prevMessage} />
                </div>
              );
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
