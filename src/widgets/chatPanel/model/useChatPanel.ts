"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { Message, MessagesPage } from "@/features/chat";
import { useMessagesQuery } from "@/features/chat/hooks/useMessagesQuery";
import { CHAT_CHANNEL_NAME, CHAT_TABLE_NAME } from "@/shared/config";
import { addMessageToCache, removeMatchingTempMessage } from "@/shared/lib";
import { useUserStore } from "@/shared/store/useUserStore";
import { RealtimeChannel } from "@supabase/supabase-js";
import { InfiniteData, useQueryClient } from "@tanstack/react-query";

import { useEffect, useMemo, useState } from "react";

export function useChatPanel() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();
  const { userId, userNickname } = useUserStore();

  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useMessagesQuery("town");

  const messages = useMemo(() => {
    const fetched = data?.pages.flatMap((page) => page.messages) ?? [];
    const reversed = [...fetched].reverse();
    return [...reversed, ...optimisticMessages];
  }, [data, optimisticMessages]);

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
    handleMessageSend,
    isConnected: !!channel,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  };
}
