"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { Message } from "@/features/chat";
import { CHAT_CHANNEL_NAME, CHAT_TABLE_NAME } from "@/shared/config";
import { useUserStore } from "@/shared/store/useUserStore";
import { RealtimeChannel } from "@supabase/supabase-js";

import { useEffect, useState } from "react";

export function useChatPanel() {
  const supabase = useSupabase();
  const { userId, userNickname } = useUserStore();

  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!supabase) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from(CHAT_TABLE_NAME)
        .select("*")
        .eq("room_id", "town")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("메시지 로딩 실패:", error);
        return;
      }

      if (data) setMessages(data);
    };

    fetchMessages();
  }, [supabase]);

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
          const newMsg = payload.new as Message;

          setMessages((prev) => {
            const alreadyExists = prev.some((msg) => msg.id === newMsg.id);
            if (alreadyExists) return prev;
            /**
             * 임시 메시지 찾기 (Optimistic UI)
             * - id < 0: 서버 응답 전 생성한 임시 메시지
             * - 같은 유저 + 같은 내용이면 매칭
             * - 동일 메시지 연속 전송 시 첫 번째 임시 메시지와 매칭됨
             */
            const isTempMessage = (msg: Message) => msg.id < 0;
            const isSameUser = (msg: Message) => msg.user_id === newMsg.user_id;
            const isSameContent = (msg: Message) => msg.message === newMsg.message;

            const matchingTempMessage = prev.find(
              (msg) => isTempMessage(msg) && isSameUser(msg) && isSameContent(msg),
            );

            if (matchingTempMessage) {
              return prev.map((msg) => (msg.id === matchingTempMessage.id ? newMsg : msg));
            }

            return [...prev, newMsg];
          });
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
  }, [userNickname, supabase]);

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
    setMessages((prev) => [...prev, tempMessage]);

    const { error } = await supabase.from(CHAT_TABLE_NAME).insert({
      user_id: userId,
      room_id: "town",
      nickname: userNickname,
      message: messageText,
    });

    if (error) {
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
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
  };
}
