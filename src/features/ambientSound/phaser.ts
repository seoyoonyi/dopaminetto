/**
 * ambientSound feature의 Phaser 런타임 전용 public entry.
 *
 * AmbientSoundController가 phaser를 로드하므로 이 파일을 import하면 module graph에 Phaser가
 * 포함된다. Phaser client runtime에서 동작하는 코드(TownScene 등)에서만 import한다.
 * 일반 app/widget/React SSR 경로에서는 @/features/ambientSound를 사용한다.
 * 이 파일은 SSR-safe 기본 배럴(./index)을 import/re-export하지 않는다(경계 유지).
 */
export { AmbientSoundController } from "./lib/AmbientSoundController";
export { resolveCampfireSources } from "./lib/resolveCampfireSources";
export {
  AMBIENT_AUDIO_KEYS,
  AMBIENT_AUDIO_URLS,
  CAMPFIRE_SOUND_CONFIG,
  CAMPFIRE_VILLAGE_IDS,
} from "./model/config";
export type { AmbientSoundFalloffConfig, AmbientSoundSource } from "./model/types";
