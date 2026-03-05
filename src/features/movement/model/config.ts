import { Position } from "./types";

export const GAME_CONFIG = {
  WIDTH: 800,
  HEIGHT: 600,
} as const;

export const LOBBY_CONFIG = {
  WIDTH: 1600,
  HEIGHT: 600,
} as const;

export const INITIAL_POSITION: Position = {
  x: LOBBY_CONFIG.WIDTH / 2,
  // 로비 y 범위(600~1200)의 중앙값(900)에서 시작합니다.
  y: LOBBY_CONFIG.HEIGHT + LOBBY_CONFIG.HEIGHT / 2,
};
