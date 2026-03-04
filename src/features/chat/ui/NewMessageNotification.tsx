"use client";

import { ScrollToBottomButton } from "./ScrollToBottomButton";

/**
 * 새 메시지 알림 컴포넌트
 *
 * 사용자가 스크롤을 올려서 과거 메시지를 보고 있을 때,
 * 새 메시지가 도착하면 하단에 표시되는 알림 버튼입니다.
 * 클릭 시 스크롤을 맨 아래로 이동시키는 동작을 수행합니다.
 * 내부적으로 ScrollToBottomButton을 사용하며, "새 메시지 N개" 텍스트를 children으로 전달합니다.
 */

interface NewMessageNotificationProps {
  onClick: () => void;
  show: boolean;
  count?: number;
}

export function NewMessageNotification({ onClick, show, count = 0 }: NewMessageNotificationProps) {
  /** 100개 이상은 99+로 표기하여 과도한 숫자 표시를 방지합니다. */
  const displayCount = count >= 100 ? "99+" : `${count}`;

  return (
    <ScrollToBottomButton show={show} onClick={onClick} ariaLabel={`새 메시지 ${displayCount}개`}>
      <span>
        새 메시지 <strong className="text-amber-300">{displayCount}개</strong>
      </span>
    </ScrollToBottomButton>
  );
}
