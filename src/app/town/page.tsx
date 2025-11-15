"use client";

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

      {/* 하단 바 컴포넌트가 들어올 예정 */}
      <div className="w-full h-10 bg-gray-100"></div>
    </div>
  );
}
