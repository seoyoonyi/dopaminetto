/**
 * 빌리지별 채팅 Realtime channel name을 생성합니다.
 * chat room_id와는 별개로, 채팅 구독 토픽을 채팅 전용 네임스페이스로 분리합니다.
 */
export const getChatChannelName = (villageId: string): string => `chat:village:${villageId}`;
