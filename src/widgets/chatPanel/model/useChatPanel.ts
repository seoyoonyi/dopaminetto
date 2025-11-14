"use client";

import { useSupabase } from "@/app/providers/SupabaseProvider";
//
import { useUserStore } from "@/shared/store/useUserStore";
//
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
  const { userNickname } = useUserStore(); //

  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Supabase Realtime 채널 연결 로직
  useEffect(() => {
    if (!userNickname || !supabase) return;

    // "에코 끄기" 옵션을 적용합니다.
    const chatChannel = supabase.channel("public:chat-room", {
      config: {
        broadcast: {
          self: false, // ⬅️ "내가 보낸 broadcast는 나에게 다시 '에코'하지 마세요"
        },
      },
    });

    chatChannel.on("broadcast", { event: "chat-message" }, (payload) => {
      const newMsg: Message = {
        user: payload.payload.nickname,
        text: payload.payload.message,
      };
      setMessages((prev) => [...prev, newMsg]);
    });
    // 구독(subscribe) 실행
    chatChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("STATUS:", status);
        setChannel(chatChannel);
      }
    });

    return () => {
      // chatChannel.unsubscribe(); 대신 아래를 사용합니다.
      supabase.removeChannel(chatChannel);
    };
  }, [userNickname, supabase]);

  // 메시지 전송 (핑퐁!) 함수
  const handleMessageSend = (messageText: string) => {
    if (!channel || !messageText || !userNickname) return;

    // "전송"할 메시지 객체를 미리 만듭니다.
    const messagePayload = {
      nickname: userNickname,
      message: messageText, // 인자로 받은 message 사용!
      timestamp: new Date().toISOString(),
    };

    // 채널을 통해 메시지를 보냅니다.
    channel.send({
      type: "broadcast",
      event: "chat-message",
      payload: messagePayload,
    });

    // 내 UI에 "즉시" 수동으로 업데이트합니다.
    setMessages((prev) => [...prev, { user: userNickname, text: messageText }]);
  };

  // UI 컴포넌트가 사용할 값들을 반환합니다.
  return {
    userNickname,
    messages,
    handleMessageSend,
    isConnected: !!channel,
  };
}
