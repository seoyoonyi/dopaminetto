/**
 * subscribe() 후 이 시간 안에 상태 콜백이 한 번도 오지 않으면 채널 고착으로 판단한다.
 * realtime-js의 기본 join timeout보다 조금 길게 두어 정상적인 연결 지연은 기다린다.
 */
export const SUBSCRIBE_WATCHDOG_MS = 15_000;

/**
 * 새 채널을 만들기 전에 같은 topic의 잔존 채널 제거를 기다리는 상한이다.
 * 죽은 소켓에서 removeChannel()이 끝나지 않아도 무한 대기하지 않는다.
 */
export const STALE_CHANNEL_REMOVAL_TIMEOUT_MS = 3_000;
