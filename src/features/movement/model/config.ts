import { Position } from "./types";

export const GAME_CONFIG = {
  WIDTH: 800,
  HEIGHT: 600,
} as const;

export const INITIAL_POSITION: Position = {
  x: GAME_CONFIG.WIDTH / 2,
  y: GAME_CONFIG.HEIGHT / 2,
};
