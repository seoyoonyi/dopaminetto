/**
 * Textarea 높이를 내용에 따라 자동으로 조절하는 훅
 * wrapper div의 높이를 제어하여 field-sizing-content와의 충돌을 방지합니다.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoResizeTextareaOptions {
  minHeight?: number;
  maxHeight?: number;
}

export function useAutoResizeTextarea(value: string, options: UseAutoResizeTextareaOptions = {}) {
  const { minHeight = 48, maxHeight = 96 } = options;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  const WRAPPER_PADDING = 24; // py-3 (12px) × 2

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    const wrapper = wrapperRef.current;
    if (!textarea || !wrapper) return;

    const contentMax = maxHeight - WRAPPER_PADDING;
    const contentMin = minHeight - WRAPPER_PADDING;

    /** 이미 스크롤 상태면 높이 재계산을 건너뜀 */
    if (isScrollable && textarea.scrollHeight >= contentMax) {
      return;
    }

    const prevScrollTop = textarea.scrollTop;

    /** textarea를 auto로 리셋하여 scrollHeight 측정 */
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const newContentHeight = Math.min(Math.max(scrollHeight, contentMin), contentMax);

    textarea.style.height = `${newContentHeight}px`;
    wrapper.style.height = `${newContentHeight + WRAPPER_PADDING}px`;

    setIsScrollable(scrollHeight > contentMax);

    /** 스크롤 위치 복구 */
    textarea.scrollTop = prevScrollTop;
  }, [minHeight, maxHeight, isScrollable]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return { textareaRef, wrapperRef, isScrollable };
}
