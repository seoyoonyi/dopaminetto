import { Position } from "./types";

export {
  CHARACTER_CONFIGS,
  CHARACTER_OPTIONS,
  DEFAULT_CHARACTER_ID,
  getCharacterConfig,
  resolveCharacterId,
} from "@/shared/constants";
export type { CharacterConfig, CharacterId } from "@/shared/types";

export const GAME_CONFIG = {
  WIDTH: 800,
  HEIGHT: 600,
  CAMERA_ZOOM: 1,
} as const;

export const INITIAL_POSITION: Position = {
  x: 0,
  y: 0,
};
