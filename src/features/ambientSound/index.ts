// Ambient Sound Feature
// 모닥불 등 위치 기반 환경음(Ambient) 재생 로직을 export
// AmbientSoundController는 사운드 종류에 무관한 범용 컨트롤러이므로, 분수/새소리/폭포 등
// 새 환경음을 추가할 때도 이 export를 그대로 재사용하면 된다.

// 비즈니스 로직 레이어
export { AmbientSoundController } from "./lib/AmbientSoundController";
export { resolveCampfireSources } from "./lib/resolveCampfireSources";

// 설정 상수
export {
  AMBIENT_AUDIO_KEYS,
  AMBIENT_AUDIO_URLS,
  CAMPFIRE_SOUND_CONFIG,
  CAMPFIRE_VILLAGE_IDS,
} from "./model/config";
export type { AmbientSoundFalloffConfig, AmbientSoundSource } from "./model/types";
