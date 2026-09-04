/**
 * 빠른 빌리지 경계 왕복 중 presence track이 과도하게 반복되지 않도록
 * town:main과 village:* 채널에서 함께 사용하는 안정화 지연 시간이다.
 */
export const PRESENCE_VILLAGE_TRACK_DEBOUNCE_MS = 1500;

/**
 * town:main이 SUBSCRIBED인 동안 로컬 presence 맵을 주기적으로 다시 반영하는 간격이다.
 * 장시간 재연결 후 grace가 만료됐지만 서버 재검증 이벤트(sync/join/leave)가 오지 않아
 * 이탈·재입장이 stale하게 남는 경우를, 서버 이벤트 없이 스스로 수렴시킨다(#173).
 * presenceState()는 로컬 메모리 읽기라 네트워크 비용이 없다.
 */
export const PRESENCE_RECONCILE_INTERVAL_MS = 10_000;
