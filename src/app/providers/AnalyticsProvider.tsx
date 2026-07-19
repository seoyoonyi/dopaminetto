"use client";

import { GA_MEASUREMENT_ID, isAnalyticsEnabled } from "@/shared/config/analytics";
import { useAnalyticsPageView } from "@/shared/hooks/useAnalyticsPageView";

import { Suspense } from "react";

import Script from "next/script";

interface AnalyticsProviderProps {
  children: React.ReactNode;
}

/** GA4 초기화 스크립트를 로드하고, 라우트 변경마다 Page View를 전송합니다. */
const AnalyticsProvider = ({ children }: AnalyticsProviderProps) => {
  if (!isAnalyticsEnabled) {
    return <>{children}</>;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
        `}
      </Script>
      <Suspense fallback={null}>
        <AnalyticsPageViewTracker />
      </Suspense>
      {children}
    </>
  );
};

/** useSearchParams를 사용하므로 Suspense 경계 안에서만 렌더링됩니다. */
const AnalyticsPageViewTracker = () => {
  useAnalyticsPageView();
  return null;
};

export default AnalyticsProvider;
