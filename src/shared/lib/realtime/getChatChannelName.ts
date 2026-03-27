/**
 * 빌리지별 채팅 Realtime channel name을 생성합니다.
 * chat room_id와는 별개이며, movement/presence 등과 같이 village 기준(`village:${villageId}`) 아래 하위 토픽 `chat`을 둡니다.
 */
export const getChatChannelName = (villageId: string): string => `village:${villageId}:chat`;
