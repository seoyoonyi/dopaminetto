"use client";

import { ChatPanel } from "@/widgets/chatPanel";

export default function TownPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* 메인 콘텐츠 영역 */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1"></div>
        <div className="flex flex-col w-96 h-full">
          <ChatPanel />
        </div>
      </div>

      {/* 하단 바 컴포넌트가 들어올 예정 */}
      <div className="w-full h-10 bg-gray-100"></div>
    </div>
  );
}
