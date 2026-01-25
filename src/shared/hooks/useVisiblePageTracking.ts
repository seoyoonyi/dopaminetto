import { useCallback, useEffect, useRef } from "react";

/**
 * 화면에 보이는 메시지들이 속한 페이지 인덱스를 추적하는 훅
 *
 * @param onVisiblePagesChange - 보이는 페이지 Set이 변경될 때 호출되는 콜백
 * @returns IntersectionObserver 참조 (각 메시지 요소를 observe에 등록)
 *
 * @example
 * const handleVisiblePagesChange = useCallback((pageIndices: Set<number>) => {
 *   console.log("Visible pages:", Array.from(pageIndices));
 * }, []);
 *
 * const observerRef = useVisiblePageTracking(handleVisiblePagesChange);
 *
 * // 각 메시지 요소에 연결
 * <div
 *   ref={(node) => node && observerRef.current?.observe(node)}
 *   data-page-index={pageIndex}
 * >
 */
export function useVisiblePageTracking(onVisiblePagesChange: (pageIndices: Set<number>) => void) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visiblePagesRef = useRef<Set<number>>(new Set());

  const updateVisiblePages = useCallback(
    (pageIndex: number, isVisible: boolean) => {
      const prevSize = visiblePagesRef.current.size;

      if (isVisible) {
        visiblePagesRef.current.add(pageIndex);
      } else {
        visiblePagesRef.current.delete(pageIndex);
      }

      // Set이 변경되었을 때만 콜백 호출
      if (prevSize !== visiblePagesRef.current.size) {
        onVisiblePagesChange(new Set(visiblePagesRef.current));
      }
    },
    [onVisiblePagesChange],
  );

  useEffect(() => {
    // IntersectionObserver 생성
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageIndex = Number(entry.target.getAttribute("data-page-index"));
          if (!isNaN(pageIndex)) {
            updateVisiblePages(pageIndex, entry.isIntersecting);
          }
        });
      },
      {
        // 요소의 10%만 보여도 카운트
        threshold: 0.1,
        // 화면 경계 50px 전후로 감지
        rootMargin: "50px",
      },
    );

    return () => {
      observerRef.current?.disconnect();
      visiblePagesRef.current.clear();
    };
  }, [updateVisiblePages]);

  return observerRef;
}
