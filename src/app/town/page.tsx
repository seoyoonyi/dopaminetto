"use client";

import { useTownPanelToggleStore } from "@/features/panelToggle";
import { useTownPresence } from "@/features/presence";
import { useUserInfo } from "@/shared/hooks";
import { useUserStore } from "@/shared/store/useUserStore";
import { ChatPanel } from "@/widgets/chatPanel";
import { TownToolbar } from "@/widgets/townToolbar";
import { UsersPanel } from "@/widgets/usersPanel";

import { useEffect } from "react";

export default function TownPage() {
  const { data: user, isLoading } = useUserInfo();
  const userNickname = user?.user_metadata?.nickname;
  const { setUserNickname } = useUserStore();
  const activePanel = useTownPanelToggleStore((state) => state.activePanel);
  useTownPresence();

  useEffect(() => {
    if (userNickname) {
      setUserNickname(userNickname);
    }
  }, [setUserNickname, userNickname]);

  const nicknameFallback = (
    <div className="flex h-full items-center justify-center text-gray-500">
      닉네임을 설정해주세요.
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center overflow-hidden">
        <p>사용자 정보를 불러오는 중...</p>
      </div>
    );
  }

  const renderPanel = () => {
    if (activePanel === "users") {
      return <UsersPanel />;
    }

    if (!userNickname) {
      return nicknameFallback;
    }

    return <ChatPanel />;
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <div className="flex-1" />
        <div className="flex h-full w-96 flex-col">{renderPanel()}</div>
      </div>

      <TownToolbar />
    </div>
  );
}
