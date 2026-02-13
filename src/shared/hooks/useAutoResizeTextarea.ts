/**
 * Textarea 높이를 내용에 따라 자동으로 조절하는 훅
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface UseAutoResizeTextareaOptions {
  minHeight?: number;
  maxHeight?: number;
  extraHeight?: number;
}

export function useAutoResizeTextarea(value: string, options: UseAutoResizeTextareaOptions = {}) {
  const { minHeight = 48, maxHeight = 96, extraHeight = 0 } = options;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  const WRAPPER_PADDING = 24; // py-3 (12px) × 2

  /** 이전 글자수 (삭제 감지용) */
  const prevValueLengthRef = useRef(value.length);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    const wrapper = wrapperRef.current;

    if (!textarea || !wrapper) return;

    /** 이미 스크롤 상태이고 글자수가 늘어났거나 같다면 높이 재계산을 건너뜀 (최적화) */
    if (
      isScrollable &&
      value.length >= prevValueLengthRef.current &&
      textarea.scrollHeight >= maxHeight
    ) {
      prevValueLengthRef.current = value.length;
      return;
    }

    prevValueLengthRef.current = value.length;

    const prevScrollTop = textarea.scrollTop;

    /** textarea를 auto로 리셋하여 scrollHeight 측정 */
    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const newContentHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);

    textarea.style.height = `${newContentHeight}px`;
    wrapper.style.height = `${newContentHeight + WRAPPER_PADDING + extraHeight}px`;

    setIsScrollable(scrollHeight > maxHeight);

    /** 스크롤 위치 복구 */
    textarea.scrollTop = prevScrollTop;
  }, [minHeight, maxHeight, extraHeight, isScrollable, value.length]);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return { textareaRef, wrapperRef, isScrollable };
}
