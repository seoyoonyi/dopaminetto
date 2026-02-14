"use client";

import { Button } from "@/shared/ui/button";
import { ArrowDown } from "lucide-react";

/**
 * 새 메시지 알림 컴포넌트
 *
 * 사용자가 스크롤을 올려서 과거 메시지를 보고 있을 때,
 * 새 메시지가 도착하면 하단에 표시되는 알림 버튼입니다.
 * 클릭 시 스크롤을 맨 아래로 이동시키는 동작을 수행합니다.
 */

interface NewMessageNotificationProps {
  onClick: () => void;
  show: boolean;
  count?: number;
}

export function NewMessageNotification({ onClick, show, count = 0 }: NewMessageNotificationProps) {
  return (
    <div
      className={`absolute right-4 -bottom-0 z-10 transition-all duration-300 sm:right-5 sm:-bottom-0 ${
        show
          ? "pointer-events-none translate-y-0 scale-100 opacity-100 animate-in fade-in zoom-in-95 slide-in-from-bottom-2"
          : "pointer-events-none translate-y-2 scale-95 opacity-0 animate-out fade-out zoom-out-95 slide-out-to-bottom-2"
      }`}
      aria-hidden={!show}
    >
      <Button
        onClick={onClick}
        className="pointer-events-auto cursor-pointer gap-2 rounded-full bg-primary/85 shadow-lg backdrop-blur-sm"
        size="sm"
        aria-label={`새 메시지 ${count}개`}
        tabIndex={show ? 0 : -1}
      >
        <ArrowDown size={16} />
        <span>
          새 메시지 <strong className="text-amber-300">{count}개</strong>
        </span>
      </Button>
    </div>
  );
}
