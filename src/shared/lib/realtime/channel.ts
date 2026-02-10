export const TOWN_MAIN_CHANNEL = "town:main";

/**
 * 특정 도메인(Village)의 채널명 생성 규칙
 *
 * - Presence(접속자 목록)는 전체 타운에서 공유합니다. (town:main 채널 사용)
 * - 좌표 동기화(broadcast)만 빌리지별 채널로 분리되어 있습니다.
 * - 이유: 다른 빌리지에 있는 유저도 접속자 목록에는 표시되어야 하기 때문입니다.
 */
export const getVillageChannelName = (villageId?: string | null) =>
  villageId ? `village:${villageId}` : TOWN_MAIN_CHANNEL;
