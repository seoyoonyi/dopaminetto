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
          setMessages((prev) => [...prev, newMsg]);
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

  const handleMessageSend = async (messageText: string) => {
    if (!messageText || !userNickname || !userId) return;

    await supabase.from(CHAT_TABLE_NAME).insert({
      user_id: userId,
      room_id: "town",
      nickname: userNickname,
      message: messageText,
    });
  };

  return {
    userNickname,
    messages,
    handleMessageSend,
    isConnected: !!channel,
  };
}
