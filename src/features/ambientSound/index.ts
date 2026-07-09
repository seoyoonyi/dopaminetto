// Ambient Sound Feature
// 모닥불 등 위치 기반 환경음(Ambient) 재생 로직을 export

// 비즈니스 로직 레이어
export { CampfireAmbientController } from "./lib/CampfireAmbientController";
export { resolveCampfireSources } from "./lib/resolveCampfireSources";

// 설정 상수
export {
  AMBIENT_AUDIO_KEYS,
  AMBIENT_AUDIO_URLS,
  CAMPFIRE_SOUND_CONFIG,
  CAMPFIRE_VILLAGE_IDS,
} from "./model/config";
export type { AmbientSoundSource } from "./model/types";
