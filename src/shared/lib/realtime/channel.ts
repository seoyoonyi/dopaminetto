export const TOWN_MAIN_CHANNEL = "town:main";

/**
 * 빌리지별 Realtime 채널명 규칙
 *
 * - Presence/좌표 모두 같은 채널을 사용합니다.
 * - villageId가 없으면 로비(town:main)에 접속합니다.
 */
export const getVillageChannelName = (villageId?: string | null) =>
  villageId ? `village:${villageId}` : TOWN_MAIN_CHANNEL;
