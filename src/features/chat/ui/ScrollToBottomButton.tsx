"use client";

import { Button } from "@/shared/ui/button";
import { ArrowDown } from "lucide-react";

/**
 * 채팅 스크롤을 맨 아래로 이동시키는 공용 둥근 버튼 컴포넌트입니다.
 *
 * ArrowDown 아이콘과 둥근 버튼 스타일, 표시/숨김 애니메이션을 담당합니다.
 * children을 통해 아이콘 옆에 추가 콘텐츠(예: "새 메시지 N개" 텍스트)를 표시할 수 있습니다.
 */

interface ScrollToBottomButtonProps {
  show: boolean;
  onClick: () => void;
  ariaLabel?: string;
  children?: React.ReactNode;
}

export function ScrollToBottomButton({
  show,
  onClick,
  ariaLabel = "맨 아래로 이동",
  children,
}: ScrollToBottomButtonProps) {
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
        size={children ? "sm" : "icon"}
        aria-label={ariaLabel}
        tabIndex={show ? 0 : -1}
      >
        <ArrowDown size={16} />
        {children}
      </Button>
    </div>
  );
}
