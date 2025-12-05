import { useEffect, useRef } from "react";

interface UseIntersectionObserverOptions {
  threshold?: number;
  rootMargin?: string;
}
/**
 * 요소가 화면에 보이는지 감지하는 훅 (무한스크롤 등에 사용)
 *
 * @param callback - 요소가 화면에 보일 때 실행할 함수
 * @param options.threshold - 요소가 얼마나 보여야 감지할지 (0~1, 기본값 0)
 * @param options.rootMargin - 감지 영역 확장 ("100px"이면 100px 전에 미리 감지)
 *
 * @example
 * const ref = useIntersectionObserver<HTMLDivElement>(onLoadMore, {
 *   rootMargin: "100px"
 * });
 *
 * return <div ref={ref} className="h-1" />;
 */
export function useIntersectionObserver<T extends HTMLElement>(
  callback: () => void,
  options: UseIntersectionObserverOptions = {},
) {
  const targetRef = useRef<T>(null);
  const { threshold = 0, rootMargin = "0px" } = options;

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          callback();
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [callback, threshold, rootMargin]);

  return targetRef;
}
