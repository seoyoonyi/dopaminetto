"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { Message, MessagesPage } from "@/features/chat";
import { useMessagesQuery } from "@/features/chat/hooks/useMessagesQuery";
import { CHAT_CHANNEL_NAME, CHAT_GC_CONFIG, CHAT_TABLE_NAME } from "@/shared/config";
import { addMessageToCache, removeMatchingTempMessage, runGarbageCollection } from "@/shared/lib";
import { useUserStore } from "@/shared/store/useUserStore";
import { RealtimeChannel } from "@supabase/supabase-js";
import { InfiniteData, useQueryClient } from "@tanstack/react-query";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function useChatPanel() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { userId, userNickname } = useUserStore();

  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useMessagesQuery("town");

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
      queryClient.setQueryData<InfiniteData<MessagesPage>>(["messages", "town"], (oldData) => {
        if (!oldData) return oldData;
        return { ...oldData, pages: newPages };
      });
    }
  }, [data?.pages, queryClient]);

  const messages = useMemo(() => {
    const fetched = data?.pages.flatMap((page) => page.messages) ?? [];
    const reversed = [...fetched].reverse();
    return [...reversed, ...optimisticMessages];
  }, [data, optimisticMessages]);

  // 보이는 페이지의 타임스탬프를 갱신하는 함수 (throttled)
  const lastUpdateTimeRef = useRef<number>(0);
  const updateVisiblePagesTimestamp = useCallback(
    (pageIndices: Set<number>) => {
      if (pageIndices.size === 0) return;

      const now = Date.now();
      // 2초 throttle
      if (now - lastUpdateTimeRef.current < 2000) return;
      lastUpdateTimeRef.current = now;

      queryClient.setQueryData<InfiniteData<MessagesPage>>(["messages", "town"], (oldData) => {
        if (!oldData) return oldData;

        const newPages = oldData.pages.map((page, index) => {
          if (pageIndices.has(index)) {
            return { ...page, lastAccessed: now };
          }
          return page;
        });

        return { ...oldData, pages: newPages };
      });
    },
    [queryClient],
  );

  useEffect(() => {
    if (!userNickname || !supabase) return;

    const chatChannel = supabase.channel(CHAT_CHANNEL_NAME);

    chatChannel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: CHAT_TABLE_NAME,
          filter: "room_id=eq.town",
        },
        (payload) => {
          const newMessage = payload.new as Message;

          setOptimisticMessages((prev) => removeMatchingTempMessage(prev, newMessage));
          queryClient.setQueryData<InfiniteData<MessagesPage>>(["messages", "town"], (oldData) =>
            addMessageToCache(oldData, newMessage),
          );
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setChannel(chatChannel);
        }
      });

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [userNickname, supabase, queryClient]);

  const handleMessageSend = async (messageText: string): Promise<{ error?: string }> => {
    if (!messageText || !userNickname || !userId) return {};

    const tempId = -Date.now();
    const tempMessage: Message = {
      id: tempId,
      user_id: userId,
      room_id: "town",
      nickname: userNickname,
      message: messageText,
      created_at: new Date().toISOString(),
    };

    setOptimisticMessages((prev) => [...prev, tempMessage]);

    const { error } = await supabase.from(CHAT_TABLE_NAME).insert({
      user_id: userId,
      room_id: "town",
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
    messages,
    data,
    handleMessageSend,
    isConnected: !!channel,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    onVisiblePagesUpdate: updateVisiblePagesTimestamp,
  };
}
