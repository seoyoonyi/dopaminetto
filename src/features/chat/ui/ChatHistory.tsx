"use client";

import { ChatMessageSkeletonList } from "@/features/chat/ui/ChatMessageSkeletonList";
import { useIntersectionObserver, useVisiblePageTracking } from "@/shared/hooks";
import { hasMultipleDates, isSameDay } from "@/shared/lib";
import { InfiniteData } from "@tanstack/react-query";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Message, MessagesPage } from "../types";
import { ChatMessageItem } from "./ChatMessageItem";
import { DateDivider } from "./DateDivider";
import { ObservedMessageWrapper } from "./ObservedMessageWrapper";

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

  /**
   * 각 메시지가 속한 페이지 인덱스를 계산합니다.
   *
   * 최적화 설명:
   * 1. 알고리즘 최적화 (Map): 기존의 이중 반복문을 제거하고, Map을 생성하여 메시지 개수에 비례하는 속도(O(N))로 조회하도록 변경했습니다.
   * 2. 렌더링 최적화 (useMemo): 데이터가 변경되지 않는 한, 이 O(N) 계산 결과조차도 캐싱하여 재사용합니다. 즉, 단순 스크롤 등으로 인한 리렌더링 시에는 계산 비용이 0이 됩니다.
   */
  const messagesWithPageIndex = useMemo(() => {
    if (!data?.pages) {
      return sortedMessages.map((msg) => ({ ...msg, pageIndex: -1 }));
    }

    // 1. 메시지 ID -> Page Index 매핑 생성 (O(Messages))
    // data.pages 구조: [Page0(messages:[...]), Page1(messages:[...])]
    const idToPageMap = new Map<number, number>();
    data.pages.forEach((page, pageIndex) => {
      page.messages.forEach((msg) => {
        idToPageMap.set(msg.id, pageIndex);
      });
    });

    // 2. 정렬된 메시지에 페이지 인덱스 매핑 (O(Messages))
    return sortedMessages.map((msg) => ({
      ...msg,
      pageIndex: idToPageMap.get(msg.id) ?? -1,
    }));
  }, [data, sortedMessages]);

  const shouldShowDateDividers = hasMultipleDates(messages);

  // 보이는 페이지 추적
  const handleVisiblePagesChange = useCallback(
    (pageIndices: Set<number>) => {
      onVisiblePagesUpdate?.(pageIndices);
    },
    [onVisiblePagesUpdate],
  );

  const observer = useVisiblePageTracking(handleVisiblePagesChange);

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
                <ObservedMessageWrapper
                  key={`message-${message.id}`}
                  pageIndex={message.pageIndex}
                  observer={observer}
                >
                  {showDateDivider && <DateDivider created_at={message.created_at} />}
                  <ChatMessageItem message={message} previousMessage={prevMessage} />
                </ObservedMessageWrapper>
              );
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
