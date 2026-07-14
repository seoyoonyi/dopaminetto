import { PlayableVillageId } from "@/entities/village";

export const AMBIENT_AUDIO_KEYS = {
  CAMPFIRE: "ambient-campfire",
} as const;

export const AMBIENT_AUDIO_URLS = {
  CAMPFIRE: "/assets/audio/ambient/campfire.mp3",
} as const;

/**
 * 모닥불 환경음의 거리 기반 감쇠 파라미터 (px, 맵 좌표 기준)
 * 소스 좌표는 Tiled Effects 레이어의 실제 campfire Point Object 좌표를 그대로 사용한다
 * (resolveCampfireSources 참고). INNER_RADIUS 이내는 항상 MAX_VOLUME, OUTER_RADIUS 이상은 항상 0이며,
 * 그 사이 구간은 선형으로 감소한다.
 * 실제 가청 여부는 거리뿐 아니라 플레이어의 현재 villageId가 모닥불의 villageId와 일치하는지로도
 * 게이트되므로(CampfireAmbientController), village-a 영역 밖(다른 마을, lobby)으로는 소리가 새어나가지 않는다.
 */
export const CAMPFIRE_SOUND_CONFIG = {
  INNER_RADIUS: 120, // 이 거리(px) 이내는 항상 MAX_VOLUME
  OUTER_RADIUS: 300, // 이 거리(px) 이상은 항상 0 (무음)
  MAX_VOLUME: 1.0,
  // 프레임마다 currentVolume을 targetVolume 쪽으로 얼마나 당길지 결정하는 ms 단위 보간 속도.
  // delta(ms) * 이 값을 Phaser.Math.Linear의 t로 사용해, 60fps 기준 약 300~500ms에 걸쳐
  // 목표 볼륨에 자연스럽게 도달하도록(급격한 볼륨 변화 방지) 튜닝된 값
  VOLUME_SMOOTHING_RATE: 0.006,
} as const;

/**
 * 모닥불을 배치할 마을 목록
 * lobby와 village-b에는 모닥불이 없어야 하므로 village-a만 포함한다.
 */
export const CAMPFIRE_VILLAGE_IDS: PlayableVillageId[] = ["village-a"];
