export const TOWN_MAIN_CHANNEL = "town:main";

/**
 * 특정 도메인(Village)의 채널명 생성 규칙
 */
export const getVillageChannelName = (villageId?: string | null) =>
  villageId ? `village:${villageId}` : TOWN_MAIN_CHANNEL;
