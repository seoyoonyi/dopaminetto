"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { ChatMessage } from "@/features/chat";
import { CHAT_CHANNEL_NAME } from "@/shared/config";
import { useUserStore } from "@/shared/store/useUserStore";
import { RealtimeChannel } from "@supabase/supabase-js";

import { useEffect, useState } from "react";

export function useChatPanel() {
  const supabase = useSupabase();
  const { userId, userNickname } = useUserStore();

  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

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
          const newMsg = payload.payload as ChatMessage;
          setMessages((prev) => [...prev, newMsg]);
        });
      }
    });

    return () => {
      supabase.removeChannel(chatChannel);
    };
  }, [userNickname, supabase]);

  const handleMessageSend = (messageText: string) => {
    if (!channel || !messageText || !userNickname || !userId) return;

    const messagePayload: ChatMessage = {
      user_id: userId,
      room_id: "town",
      nickname: userNickname,
      message: messageText,
      created_at: new Date().toISOString(),
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
