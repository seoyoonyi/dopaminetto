"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { Message, MessagesPage } from "@/features/chat";
import { useMessagesQuery } from "@/features/chat/hooks/useMessagesQuery";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { CHAT_GC_CONFIG, CHAT_TABLE_NAME } from "@/shared/config";
import {
  addMessageToCache,
  getChatChannelName,
  getChatRoomId,
  removeMatchingTempMessage,
  runGarbageCollection,
} from "@/shared/lib";
import { useChatVisibilityActions, useUserStore, useVisiblePageIndices } from "@/shared/store";
import { InfiniteData, useQueryClient } from "@tanstack/react-query";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * 채팅 패널의 주요 비즈니스 로직을 관리하는 커스텀 훅입니다.
 *
 * 주요 기능:
 * - Supabase Realtime 구독을 통한 실시간 메시지 수신
 * - 무한 스크롤 데이터 페칭 (React Query)
 * - 가비지 컬렉션(GC) 로직 트리거
 * - 메시지 전송 및 낙관적 업데이트(Optimistic Updates)
 * - 읽은 메시지(뷰포트 내 페이지)의 타임스탬프 갱신
 * - 빌리지별 채팅 채널 분리 (room_id: village:${villageId}, Realtime topic: getChatChannelName)
 */
export function useChatPanel() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { userId, userNickname } = useUserStore();
  const villageId = useMovementStore((state) => state.villageId);
  const chatChannelName = getChatChannelName(villageId);
  const roomId = getChatRoomId(villageId);

  const [channelStatus, setChannelStatus] = useState("INITIAL");
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  // Zustand 스토어 사용
  const { setVisiblePages } = useChatVisibilityActions();
  const visiblePageIndices = useVisiblePageIndices();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useMessagesQuery(roomId);

  // 빌리지 이동 시 낙관적 메시지 초기화
  // React 공식 권장 패턴: useState로 이전 roomId를 추적하여 렌더 중 비교합니다.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevRoomId, setPrevRoomId] = useState(roomId);
  if (prevRoomId !== roomId) {
    setPrevRoomId(roomId);
    setOptimisticMessages([]);
  }

  // 빌리지 전환 시 이전 채널 상태를 현재 UI에 남기지 않도록 렌더 중 비교로 초기화합니다.
  const [prevChatChannelName, setPrevChatChannelName] = useState(chatChannelName);
  if (prevChatChannelName !== chatChannelName) {
    setPrevChatChannelName(chatChannelName);
    setChannelStatus("INITIAL");
  }

  // GC Trigger: 페이지 수가 너무 많아지면 정리 (Infinite Scroll 등으로 인해)
  // useMessagesQuery는 자동으로 pages를 append 하므로, 여기서 감지해서 줄여줘야 함.
  useEffect(() => {
    if (!data?.pages || !CHAT_GC_CONFIG.ENABLED) return;

    const currentPages = data.pages;
    if (currentPages.length <= CHAT_GC_CONFIG.MAX_PAGES) return;

    // GC 실행 필요
    const newPages = runGarbageCollection(currentPages, {
      maxPages: CHAT_GC_CONFIG.MAX_PAGES,
      minVisiblePages: CHAT_GC_CONFIG.MIN_VISIBLE_PAGES,
      protectedTimeMs: CHAT_GC_CONFIG.PROTECTED_TIME_MS,
    });

    // 변경사항이 있을 때만 업데이트 (무한 루프 방지)
    if (newPages.length !== currentPages.length) {
      queryClient.setQueryData<InfiniteData<MessagesPage>>(["messages", roomId], (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, pages: newPages };
      });
    }
  }, [data?.pages?.length, queryClient, roomId]);

  const messages = useMemo(() => {
    const fetched = data?.pages.flatMap((page) => page.messages) ?? [];
    const reversed = [...fetched].reverse();
    return [...reversed, ...optimisticMessages];
  }, [data, optimisticMessages]);

  // 보이는 페이지의 타임스탬프를 갱신하는 Effect (Debounced)
  // Zustand 상태(visiblePageIndices)가 변경될 때마다 타이머를 재설정하여,
  // 변경이 멈춘 후 2초 뒤에 최종적으로 캐시를 업데이트합니다.
  useEffect(() => {
    if (visiblePageIndices.size === 0) return;

    const timeoutId = setTimeout(() => {
      const now = Date.now();
      queryClient.setQueryData<InfiniteData<MessagesPage>>(["messages", roomId], (oldData) => {
        if (!oldData) return oldData;

        const newPages = oldData.pages.map((page, index) => {
          if (visiblePageIndices.has(index)) {
            return { ...page, lastAccessed: now };
          }
          return page;
        });

        return { ...oldData, pages: newPages };
      });
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [visiblePageIndices, queryClient, roomId]);

  // UI 컴포넌트에서 호출할 간단한 업데이트 함수 (Zustand 액션만 호출)
  const updateVisiblePagesTimestamp = useCallback(
    (pageIndices: Set<number>) => {
      setVisiblePages(pageIndices);
    },
    [setVisiblePages],
  );

  useEffect(() => {
    if (!userNickname || !supabase) return;

    let isActive = true;

    const chatChannel = supabase.channel(chatChannelName);

    chatChannel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: CHAT_TABLE_NAME,
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;

          setOptimisticMessages((prev) => removeMatchingTempMessage(prev, newMessage));
          queryClient.setQueryData<InfiniteData<MessagesPage>>(["messages", roomId], (oldData) =>
            addMessageToCache(oldData, newMessage),
          );
        },
      )
      .subscribe((status) => {
        if (!isActive) return;
        setChannelStatus(status);
      });

    return () => {
      isActive = false;
      supabase.removeChannel(chatChannel);
    };
  }, [chatChannelName, userNickname, supabase, queryClient, roomId]);

  const handleMessageSend = async (messageText: string): Promise<{ error?: string }> => {
    if (!messageText || !userNickname || !userId) return {};

    const tempId = -Date.now();
    const tempMessage: Message = {
      id: tempId,
      user_id: userId,
      room_id: roomId,
      nickname: userNickname,
      message: messageText,
      created_at: new Date().toISOString(),
    };

    setOptimisticMessages((prev) => [...prev, tempMessage]);

    const { error } = await supabase.from(CHAT_TABLE_NAME).insert({
      user_id: userId,
      room_id: roomId,
      nickname: userNickname,
      message: messageText,
    });

    if (error) {
      setOptimisticMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      console.error("메시지 전송 실패:", error);
      return { error: error.message };
    }

    return {};
  };

  return {
    userNickname,
    userId,
    messages,
    data,
    handleMessageSend,
    isConnected: channelStatus === "SUBSCRIBED",
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onVisiblePagesUpdate: updateVisiblePagesTimestamp,
    roomId,
  };
}
