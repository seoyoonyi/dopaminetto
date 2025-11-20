"use client";

import { SystemMessage } from "@/features/chat/types";

interface SystemMessageItemProps {
  message: SystemMessage;
}

export function SystemMessageItem({ message }: SystemMessageItemProps) {
  return (
    <div role="status" aria-live="polite" className="my-2 text-center text-xs text-gray-400">
      {message.nickname} {message.type === "join" ? "입장했습니다." : "퇴장했습니다."}
    </div>
  );
}
