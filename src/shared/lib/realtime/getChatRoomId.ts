/**
 * 빌리지별 채팅 room_id를 생성합니다.
 * Realtime 채널명(getVillageChannelName)과 다르게 채팅 DB room_id 전용 유틸입니다.
 * 로비(lobby) 포함 모든 빌리지는 "village:${villageId}" 형태를 사용합니다.
 */
export const getChatRoomId = (villageId: string): string => `village:${villageId}`;
