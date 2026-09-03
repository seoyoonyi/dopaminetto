"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import {
  Message,
  MessagesPage,
  addMessageToCache,
  removeMatchingTempMessage,
  runGarbageCollection,
} from "@/features/chat";
import { useMessagesQuery } from "@/features/chat/hooks/useMessagesQuery";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { CHAT_GC_CONFIG, CHAT_TABLE_NAME } from "@/shared/config";
import { getChatChannelName, getChatRoomId } from "@/shared/lib";
import { useChatVisibilityActions, useUserStore, useVisiblePageIndices } from "@/shared/store";
import { InfiniteData, useQueryClient } from "@tanstack/react-query";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { subscribeChatChannelWithReconnect } from "./chatChannelReconnect";

/**
 * realtime 채널이 SUBSCRIBED로 확인된 동안의 재동기화 폴링 간격. 채널이 조용히 죽어
 * 상태만 SUBSCRIBED로 stale하게 남는 경우를 대비한 느린 안전망이다.
 */
const CHAT_RECONCILE_INTERVAL_SUBSCRIBED_MS = 60_000;
/** 채널이 끊겼거나 아직 SUBSCRIBED로 확인되지 않은 동안의 빠른 재동기화 폴링 간격. */
const CHAT_RECONCILE_INTERVAL_DISCONNECTED_MS = 15_000;

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
  /**
   * temp 메시지 id 발급용 단조 증가 카운터다. `-Date.now()`는 같은 밀리초에 연속
   * 전송하면 두 temp가 동일한 id를 가져, 하나만 확정돼도 둘 다 사라지는 문제가 있었다.
   */
  const tempMessageIdRef = useRef(0);

  // Zustand 스토어 사용
  const { setVisiblePages } = useChatVisibilityActions();
  const visiblePageIndices = useVisiblePageIndices();

  // realtime 채널 상태에 따라 재동기화 간격을 조절한다. 재구독 시점의 backfill(아래
  // onResubscribe)이 갭 대부분을 메우고, 이 폴링은 재연결이 영영 안 되거나 상태만
  // stale하게 SUBSCRIBED로 남는 경우까지 커버하는 안전망이다.
  const reconcileIntervalMs =
    channelStatus === "SUBSCRIBED"
      ? CHAT_RECONCILE_INTERVAL_SUBSCRIBED_MS
      : CHAT_RECONCILE_INTERVAL_DISCONNECTED_MS;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMessagesQuery(
    roomId,
    { reconcileIntervalMs },
  );

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

    return subscribeChatChannelWithReconnect<Message>({
      supabase,
      channelName: chatChannelName,
      table: CHAT_TABLE_NAME,
      roomFilter: `room_id=eq.${roomId}`,
      onInsert: (payload) => {
        const newMessage = payload.new;

        setOptimisticMessages((prev) => removeMatchingTempMessage(prev, newMessage));
        queryClient.setQueryData<InfiniteData<MessagesPage>>(["messages", roomId], (oldData) =>
          addMessageToCache(oldData, newMessage),
        );
      },
      onStatusChange: setChannelStatus,
      onResubscribe: () => {
        // 재구독 갭 동안 realtime이 놓친 메시지를 다시 fetch해 채워 넣는다.
        void queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
      },
    });
  }, [chatChannelName, userNickname, supabase, queryClient, roomId]);

  const handleMessageSend = async (messageText: string): Promise<{ error?: string }> => {
    if (!messageText || !userNickname || !userId) return {};

    const tempId = -++tempMessageIdRef.current;
    const tempMessage: Message = {
      id: tempId,
      user_id: userId,
      room_id: roomId,
      nickname: userNickname,
      message: messageText,
      created_at: new Date().toISOString(),
    };

    setOptimisticMessages((prev) => [...prev, tempMessage]);

    const { data, error } = await supabase
      .from(CHAT_TABLE_NAME)
      .insert({
        user_id: userId,
        room_id: roomId,
        nickname: userNickname,
        message: messageText,
      })
      .select()
      .single();

    if (error) {
      setOptimisticMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      console.error("메시지 전송 실패:", error);
      return { error: error.message };
    }

    // Realtime postgres_changes INSERT echo를 기다리지 않고, insert 성공 응답으로 즉시
    // temp -> confirmed 전환한다. background/재연결 중이라 채널이 SUBSCRIBED가 아니어서
    // echo를 영영 못 받는 경우에도 내 메시지는 회색으로 고착되지 않는다. tempId로 직접
    // 제거하므로(내용 매칭이 아님) 동일 문구를 연속 전송해도 서로 다른 temp가 잘못 지워지지
    // 않는다. echo가 나중에 도착해도 addMessageToCache의 id 중복 체크가 재추가를 막는다.
    const confirmedMessage = data as Message;
    setOptimisticMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    queryClient.setQueryData<InfiniteData<MessagesPage>>(["messages", roomId], (oldData) =>
      addMessageToCache(oldData, confirmedMessage),
    );

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
    villageId,
  };
}
