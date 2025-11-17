"use client";

import { PresenceToolbarButton } from "@/features/presence";
import { useUserInfo } from "@/shared/hooks";
import { useUserStore } from "@/shared/store/useUserStore";
import { ChatPanel } from "@/widgets/chatPanel";

import { useEffect } from "react";

export default function TownPage() {
  const { data: user, isLoading } = useUserInfo();
  const userNickname = user?.user_metadata?.nickname;
  const { setUserNickname } = useUserStore();

  useEffect(() => {
    if (userNickname) {
      setUserNickname(userNickname);
    }
  }, [setUserNickname, userNickname]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen overflow-hidden items-center justify-center">
        <p>사용자 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex flex-1 min-h-0">
        <div className="flex-1"></div>
        <div className="flex flex-col w-96 h-full">
          {userNickname ? (
            <ChatPanel userNickname={userNickname} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              닉네임을 설정해주세요.
            </div>
          )}
        </div>
      </div>

      <div className="w-full h-12 bg-gray-100 flex items-center justify-end px-4">
        <PresenceToolbarButton />
      </div>
    </div>
  );
}
