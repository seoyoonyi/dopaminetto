"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { Message } from "@/features/chat/types";
import { CHAT_CHANNEL_NAME } from "@/shared/config";
import { useUserStore } from "@/shared/store/useUserStore";
import { RealtimeChannel } from "@supabase/supabase-js";

import { useEffect, useState } from "react";

export function useChatPanel() {
  const supabase = useSupabase();
  const { userNickname } = useUserStore();

  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!userNickname || !supabase) return;

    const chatChannel = supabase.channel(CHAT_CHANNEL_NAME, {
      config: {
        broadcast: {
          self: true,
        },
      },
    });

    chatChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setChannel(chatChannel);

        chatChannel.on("broadcast", { event: "chat-message" }, (payload) => {
          const newMsg: Message = {
            user: payload.payload.nickname,
            text: payload.payload.message,
            timestamp: payload.payload.timestamp,
          };
          setMessages((prev) => [...prev, newMsg]);
        });
      }
    });

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [userNickname, supabase]);

  const handleMessageSend = (messageText: string) => {
    if (!channel || !messageText || !userNickname) return;

    const messagePayload = {
      nickname: userNickname,
      message: messageText,
      timestamp: new Date().toISOString(),
    };

    channel.send({
      type: "broadcast",
      event: "chat-message",
      payload: messagePayload,
    });
  };

  return {
    userNickname,
    messages,
    handleMessageSend,
    isConnected: !!channel,
  };
}
