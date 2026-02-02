/**
 * IntersectionObserver를 사용하여 메시지 요소의 가시성을 추적하는 래퍼 컴포넌트입니다.
 *
 * 이 컴포넌트는 마운트 시 observer.observe를 호출하고,
 * 언마운트 시 observer.unobserve를 자동으로 호출하여 메모리 누수를 방지합니다.
 *
 * 주요 기능:
 * - IntersectionObserver 생명주기 관리
 * - 페이지 인덱스 데이터 속성 주입
 */
"use client";

import { useEffect, useRef } from "react";

/**
 * IntersectionObserver를 사용하여 메시지 요소의 가시성을 추적하는 래퍼 컴포넌트입니다.
 *
 * 이 컴포넌트는 마운트 시 observer.observe를 호출하고,
 * 언마운트 시 observer.unobserve를 자동으로 호출하여 메모리 누수를 방지합니다.
 *
 * 주요 기능:
 * - IntersectionObserver 생명주기 관리
 * - 페이지 인덱스 데이터 속성 주입
 */

interface ObservedMessageWrapperProps {
  children: React.ReactNode;
  pageIndex: number;
  observer: IntersectionObserver | null;
}

export function ObservedMessageWrapper({
  children,
  pageIndex,
  observer,
}: ObservedMessageWrapperProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !observer || pageIndex < 0) return;

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [observer, pageIndex]);

  return (
    <div ref={ref} data-page-index={pageIndex}>
      {children}
    </div>
  );
}
