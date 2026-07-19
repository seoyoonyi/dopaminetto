// GA4 Measurement ID. 값이 없으면 Analytics 관련 기능은 전부 비활성화됩니다.
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export const isAnalyticsEnabled = Boolean(GA_MEASUREMENT_ID);
