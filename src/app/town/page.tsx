"use client";

import { ChatHistory } from "@/features/chat";
import { useUserStore } from "@/shared/store";

export default function TownPage() {
  const { userNickname } = useUserStore();

  return (
    <div className="flex">
      {/*  Map 컴포넌트가 들어올 예정 */}
      <div className="flex-1"></div>

      <ChatHistory userNickname={userNickname} />
    </div>
  );
}
