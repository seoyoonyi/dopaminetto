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
