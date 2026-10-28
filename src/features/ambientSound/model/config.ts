import { AmbientSoundFalloffConfig } from "@/features/ambientSound/model/types";

/**
 * 환경음 종류별 Phaser 오디오 키. 새 환경음(분수, 새소리, 폭포 등)을 추가할 때는
 * 여기에 키를 하나 더 등록하고, AMBIENT_AUDIO_URLS에 에셋 경로를 짝지어 추가한다.
 */
export const AMBIENT_AUDIO_KEYS = {
  CHRISTMAS_TREE: "ambient-christmas-tree",
} as const;

export const AMBIENT_AUDIO_URLS = {
  CHRISTMAS_TREE: "/assets/audio/ambient/christmas-carol.mp3",
} as const;

/** 트리 캐롤의 초기 근거리·외곽 감쇠값. 실제 청취 후 조정한다. */
export const CHRISTMAS_TREE_SOUND_CONFIG: AmbientSoundFalloffConfig = {
  innerRadius: 100,
  outerRadius: 320,
  maxVolume: 1,
  minVolume: 0.05,
  volumeSmoothingRate: 0.006,
};
