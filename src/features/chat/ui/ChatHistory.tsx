"use client";

import { ChatMessageSkeletonList } from "@/features/chat/ui/ChatMessageSkeletonList";
import { useIntersectionObserver, useVisiblePageTracking } from "@/shared/hooks";
import { hasMultipleDates, isSameDay } from "@/shared/lib";
import { InfiniteData } from "@tanstack/react-query";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Message, MessagesPage } from "../types";
import { ChatMessageItem } from "./ChatMessageItem";
import { DateDivider } from "./DateDivider";
import { NewMessageNotification } from "./NewMessageNotification";
import { ObservedMessageWrapper } from "./ObservedMessageWrapper";
import { ScrollToBottomButton } from "./ScrollToBottomButton";

interface ChatHistoryProps {
  messages: Message[];
  data?: InfiniteData<MessagesPage>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  onVisiblePagesUpdate?: (pageIndices: Set<number>) => void;
  currentUserId?: string;
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
  currentUserId,
}: ChatHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  const lastMessageIdRef = useRef<number | null>(null);
  /**
   * 상단 페이지 prepend(fetchNextPage) 전 기준 앵커 위치를 저장합니다.
   * prepend 이후 동일 메시지의 offset 변화를 이용해 사용자가 보던 시점을 유지합니다.
   */
  const prependAnchorRef = useRef<{ messageId: number; top: number } | null>(null);
  /**
   * 사용자가 마지막으로 확인한(하단에 있었던) 메시지 ID를 저장합니다.
   * 이 ID 이후에 추가된 메시지 수를 계산하여 신규 메시지 카운트로 사용합니다.
   * useMemo에서 안전하게 참조하기 위해 useRef 대신 useState로 관리합니다.
   */
  const [lastSeenMessageId, setLastSeenMessageId] = useState<number | null>(null);

  const [skeletonCount, setSkeletonCount] = useState(DEFAULT_SKELETON_COUNT);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      if (a.id < 0 && b.id >= 0) return 1;
      if (a.id >= 0 && b.id < 0) return -1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [messages]);

  /**
   * lastSeenMessageId 이후에 반영된 신규 메시지 수를 계산합니다.
   * 이벤트 단위가 아닌 실제 화면에 반영된 메시지 수 기준이므로,
   * 배치로 여러 메시지가 도착해도 정확한 카운트를 반환합니다.
   */
  const newMessageCount = useMemo(() => {
    if (!hasNewMessage || lastSeenMessageId === null) return 0;
    const seenIndex = sortedMessages.findIndex((m) => m.id === lastSeenMessageId);
    if (seenIndex === -1) return sortedMessages.length;
    return sortedMessages.length - 1 - seenIndex;
  }, [sortedMessages, hasNewMessage, lastSeenMessageId]);

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
      const anchorId = sortedMessages[0]?.id;
      if (anchorId != null) {
        const anchorEl = container.querySelector<HTMLElement>(`[data-message-id="${anchorId}"]`);
        if (anchorEl) {
          prependAnchorRef.current = {
            messageId: anchorId,
            top: anchorEl.offsetTop,
          };
        }
      }
    }

    onLoadMore?.();
  }, [hasMore, isLoading, onLoadMore, isFetchingNextPage, sortedMessages]);

  const topObserverRef = useIntersectionObserver<HTMLDivElement>(handleLoadMore, {
    rootMargin: "100px",
  });

  useEffect(() => {
    if (!isFirstRender.current) return;
    if (sortedMessages.length === 0) return;

    lastMessageIdRef.current = sortedMessages[sortedMessages.length - 1]?.id ?? null;
    isFirstRender.current = false;

    /**
     * 초기 렌더 시 스크롤을 맨 아래로 이동합니다.
     * rAF를 중첩하여 브라우저 레이아웃이 완전히 확정된 후 scrollTop을 최대값으로 설정합니다.
     * 이후 scroll 이벤트를 수동으로 dispatch하여 handleScroll이 실행되고
     * isScrolledUp 상태가 정확히 false로 설정되도록 합니다.
     */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;
        container.scrollTop = container.scrollHeight;
        container.dispatchEvent(new Event("scroll"));
      });
    });
  }, [sortedMessages]);

  // 스크롤 임계값 (px)
  const SCROLL_THRESHOLD = 20;
  const isAtBottomRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollHeight, scrollTop, clientHeight } = container;
      const isBottom = scrollHeight - scrollTop - clientHeight <= SCROLL_THRESHOLD;

      isAtBottomRef.current = isBottom;
      setIsScrolledUp(!isBottom);

      // 사용자가 직접 맨 아래로 스크롤하면 알림 끄기
      // 단, 이미 꺼져있을 때는 상태 업데이트를 발생시키지 않도록 하여 불필요한 렌더링을 방지합니다.
      if (isBottom) {
        setHasNewMessage((prev) => {
          if (prev) {
            setLastSeenMessageId(null);
            return false;
          }
          return prev;
        });
      }
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (sortedMessages.length === 0) return;

    const lastMsg = sortedMessages[sortedMessages.length - 1];
    const lastMsgId = lastMsg?.id;
    if (lastMsgId == null) return;

    if (lastMessageIdRef.current === null) {
      lastMessageIdRef.current = lastMsgId;
      return;
    }
    if (lastMessageIdRef.current === lastMsgId) return;

    if (isFirstRender.current) {
      lastMessageIdRef.current = lastMsgId;
      return;
    }

    const isMyMessage = currentUserId && lastMsg.user_id === currentUserId;

    if (isMyMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      lastMessageIdRef.current = lastMsgId;
      return;
    }

    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      lastMessageIdRef.current = lastMsgId;
      return;
    }

    // 아직 lastSeenMessageId가 없으면 현재 마지막 메시지를 기준점으로 설정합니다.
    setLastSeenMessageId((prev) => prev ?? lastMessageIdRef.current);
    requestAnimationFrame(() => {
      setHasNewMessage(true);
    });
    lastMessageIdRef.current = lastMsgId;
  }, [sortedMessages, currentUserId]);

  const handleNotificationClick = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setHasNewMessage(false);
    setLastSeenMessageId(null);
  }, []);

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

    /**
     * prepend 완료 후 기존 앵커 메시지의 offset 차이만큼 scrollTop을 보정합니다.
     * 이 방식은 상단 로드와 하단 신규 메시지 수신이 동시에 일어나도 읽던 위치를 유지합니다.
     */
    if (prependAnchorRef.current && !isFetchingNextPage) {
      const { messageId, top: prevTop } = prependAnchorRef.current;
      const anchorEl = container.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);

      if (anchorEl) {
        const offsetDiff = anchorEl.offsetTop - prevTop;
        container.scrollTop += offsetDiff;
      }

      prependAnchorRef.current = null;
    }
  }, [messages, isFetchingNextPage]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-3 py-2 text-sm font-semibold">채팅</div>

      <div className="relative flex min-h-0 flex-1">
        <div
          ref={containerRef}
          data-testid="chat-history-scroll-container"
          className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto p-3 text-sm"
        >
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
                  <div key={`message-${message.id}`} data-message-id={message.id}>
                    <ObservedMessageWrapper
                      pageIndex={message.pageIndex}
                      observer={observer.current}
                    >
                      {showDateDivider && <DateDivider created_at={message.created_at} />}
                      <ChatMessageItem message={message} previousMessage={prevMessage} />
                    </ObservedMessageWrapper>
                  </div>
                );
              })}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {hasNewMessage ? (
          <NewMessageNotification
            show={hasNewMessage}
            count={newMessageCount}
            onClick={handleNotificationClick}
          />
        ) : (
          <ScrollToBottomButton
            show={isScrolledUp}
            onClick={handleNotificationClick}
            ariaLabel="맨 아래로 이동"
          />
        )}
      </div>
    </div>
  );
}
