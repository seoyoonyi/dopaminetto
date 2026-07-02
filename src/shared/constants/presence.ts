/**
 * 빠른 빌리지 경계 왕복 중 presence track이 과도하게 반복되지 않도록
 * town:main과 village:* 채널에서 함께 사용하는 안정화 지연 시간이다.
 */
export const PRESENCE_VILLAGE_TRACK_DEBOUNCE_MS = 1500;
