import { GA_MEASUREMENT_ID, isAnalyticsEnabled } from "@/shared/config/analytics";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

interface AnalyticsEventParams {
  action: string;
  category?: string;
  label?: string;
  value?: number;
}

/** 라우트 변경 시 GA4에 Page View 이벤트를 전송합니다. */
export const pageview = (url: string) => {
  if (!isAnalyticsEnabled || typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("config", GA_MEASUREMENT_ID, { page_path: url });
};

/** GA4에 커스텀 이벤트를 전송합니다. */
export const trackEvent = ({ action, category, label, value }: AnalyticsEventParams) => {
  if (!isAnalyticsEnabled || typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", action, {
    event_category: category,
    event_label: label,
    value,
  });
};
