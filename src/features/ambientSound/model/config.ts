import { PlayableVillageId } from "@/entities/village";

export const AMBIENT_AUDIO_KEYS = {
  CAMPFIRE: "ambient-campfire",
} as const;

export const AMBIENT_AUDIO_URLS = {
  CAMPFIRE: "/assets/audio/ambient/campfire.mp3",
} as const;

/**
 * 모닥불 환경음의 거리 기반 감쇠 파라미터 (px, 맵 좌표 기준)
 * INNER_RADIUS 이내는 최대 볼륨, 가청 반경(OUTER_RADIUS)을 벗어나면 재생을 중지한다.
 *
 * 가청 반경은 이 상수로 고정하지 않고 마을별로 동적으로 계산한다(resolveCampfireSources 참고).
 * 마을(VillageArea) 중심에서 가장 먼 모서리까지의 거리(대각선의 절반) + OUTER_RADIUS_MARGIN으로
 * 계산해, Tiled에서 village-a 영역 크기/위치를 바꿔도 항상 영역 전체를 커버하도록 보장한다.
 * 다만 실제 가청 여부는 이 반경뿐 아니라 플레이어의 현재 villageId가 모닥불의 villageId와
 * 일치하는지로도 게이트되므로(CampfireAmbientController), 반경이 넓어져도 다른 마을이나
 * lobby로 소리가 새어나가지는 않는다.
 */
export const CAMPFIRE_SOUND_CONFIG = {
  INNER_RADIUS: 150, // 이 거리 이내는 항상 최대 볼륨
  OUTER_RADIUS_MARGIN: 50, // 마을 대각선 절반 거리에 더할 여유 마진
  MIN_OUTER_RADIUS: 300, // 마을이 매우 작아져도 최소한 이 거리까지는 페이드 구간을 유지
  MAX_VOLUME: 0.5,
} as const;

/**
 * 모닥불을 배치할 마을 목록
 * lobby와 village-b에는 모닥불이 없어야 하므로 village-a만 포함한다.
 */
export const CAMPFIRE_VILLAGE_IDS: PlayableVillageId[] = ["village-a"];
