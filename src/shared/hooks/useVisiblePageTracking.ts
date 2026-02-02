import { useCallback, useEffect, useRef } from "react";

/**
 * 화면에 보이는 메시지들이 속한 페이지 인덱스를 추적하는 훅입니다.
 *
 * IntersectionObserver를 사용하여 각 메시지 요소의 가시성을 감지하고,
 * 화면에 보이는 메시지들이 속한 페이지 인덱스들의 집합(Set)을 관리합니다.
 *
 * 주요 동작:
 * - IntersectionObserver를 생성하고 ref로 관리하여, 불필요한 리렌더링을 방지합니다.
 * - 관찰 대상 요소가 화면에 들어오거나 나갈 때 내부 Map을 업데이트합니다.
 * - 보이는 페이지 목록이 변경되면 onVisiblePagesChange 콜백을 호출합니다.
 *
 * 사용법:
 * 반환된 observer 객체를 관찰하고자 하는 DOM 요소에 연결하거나,
 * observe 메서드를 직접 호출하여 사용합니다.
 * 각 대상 요소는 data-page-index 속성을 가지고 있어야 합니다.
 */
export function useVisiblePageTracking(onVisiblePagesChange: (pageIndices: Set<number>) => void) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Element -> PageIndex 매핑을 통해 개별 요소의 가시성 추적
  const visibleElementsRef = useRef<Map<Element, number>>(new Map());

  const processUpdates = useCallback(() => {
    const currentVisiblePages = new Set(visibleElementsRef.current.values());
    onVisiblePagesChange(currentVisiblePages);
  }, [onVisiblePagesChange]);

  useEffect(() => {
    // IntersectionObserver 생성
    const newObserver = new IntersectionObserver(
      (entries) => {
        let hasChanges = false;
        entries.forEach((entry) => {
          const pageIndex = Number(entry.target.getAttribute("data-page-index"));
          if (isNaN(pageIndex)) return;

          if (entry.isIntersecting) {
            visibleElementsRef.current.set(entry.target, pageIndex);
            hasChanges = true;
          } else {
            if (visibleElementsRef.current.has(entry.target)) {
              visibleElementsRef.current.delete(entry.target);
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          processUpdates();
        }
      },
      {
        // 요소의 10%만 보여도 카운트
        threshold: 0.1,
        // 화면 경계 50px 전후로 감지합니다.
        // rootMargin을 50px로 두어 실제 뷰포트에 들어오기 직전에 "보이는" 것으로 처리합니다.
        // 이는 스크롤 시 콘텐츠 깜빡임을 줄이고, 다음 페이지 데이터를 미리 준비하기 위한 것으로
        // GC/페이지 추적 로직에서 "실제 가시성"에 대한 허용 가능한 근사값으로 간주합니다.
        // (즉, 약간 일찍 페이지가 접근된 것으로 기록되는 것은 의도된 동작입니다.)
        rootMargin: "50px",
      },
    );

    observerRef.current = newObserver;

    return () => {
      newObserver.disconnect();
      visibleElementsRef.current.clear();
      observerRef.current = null;
    };
  }, [processUpdates]);

  return observerRef;
}
