"use client";

import { pageview } from "@/shared/lib/analytics";

import { useEffect } from "react";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * 라우트(pathname, query) 변경을 감지해 GA4에 Page View 이벤트를 전송합니다.
 * useSearchParams를 사용하므로 반드시 Suspense 경계 내부에서 사용해야 합니다.
 */
export function useAnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    pageview(query ? `${pathname}?${query}` : pathname);
  }, [pathname, searchParams]);
}
