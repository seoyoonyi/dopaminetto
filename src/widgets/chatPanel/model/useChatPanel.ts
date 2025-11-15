"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
import { useUserStore } from "@/shared/store/useUserStore";
import { RealtimeChannel } from "@supabase/supabase-js";

import { useEffect, useState } from "react";

// (TODO: types.ts 분리 예정)
interface Message {
  user: string;
  text: string;
  timestamp?: string;
}

export function useChatPanel() {
  const supabase = useSupabase();
  const { userNickname } = useUserStore();

  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!userNickname || !supabase) return;

    const chatChannel = supabase.channel("public:chat-room", {
      config: {
        broadcast: {
          self: false,
        },
      },
    });

    chatChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("STATUS:", status);
        setChannel(chatChannel);

        chatChannel.on("broadcast", { event: "chat-message" }, (payload) => {
          const newMsg: Message = {
            user: payload.payload.nickname,
            text: payload.payload.message,
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

    setMessages((prev) => [
      ...prev,
      { user: userNickname, text: messageText, timestamp: messagePayload.timestamp },
    ]);
  };

  return {
    userNickname,
    messages,
    handleMessageSend,
    isConnected: !!channel,
  };
}
