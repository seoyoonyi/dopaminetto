// Movement Feature
// 플레이어 이동 기능 관련 컴포넌트와 로직을 export

// 비즈니스 로직 레이어
export { useMovementStore } from "./model/useMovementStore";

// UI 컴포넌트 레이어
export { TownEngine } from "./ui/TownEngine";

// 설정 상수
export {
  CHARACTER_CONFIGS,
  CHARACTER_OPTIONS,
  DEFAULT_CHARACTER_ID,
  GAME_CONFIG,
  getCharacterConfig,
  resolveCharacterId,
} from "./model/config";
export type { CharacterConfig, CharacterId } from "./model/config";
