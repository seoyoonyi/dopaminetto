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
  // 로비 y 범위(600~1200)의 중앙값(900)에서 시작
  y: LOBBY_CONFIG.HEIGHT + LOBBY_CONFIG.HEIGHT / 2,
};

/**
 * 캐릭터 스프라이트 에셋 정보 및 렌더링 규격 설정 상수
 */
export const CHARACTER_CONFIG = {
  assetKey: "p-boy-sprite",
  assetUrl: "/assets/images/p-boy-sprite-s.png",
  imageWidth: 147, // 원본 이미지 전체 가로 크기
  imageHeight: 348, // 원본 이미지 전체 세로 크기
  scale: 1, // 화면 표시 배율
  originY: 1, // 캐릭터 발밑을 기준점으로 설정하여 지면 접지력을 높이고 이름표 위치 고정

  /**
   * 스프라이트 시트 가로 프레임 개수(3열) 기준 한 칸 너비 계산
   */
  get frameWidth() {
    return this.imageWidth / 3;
  },
  /**
   * 스프라이트 시트 세로 프레임 개수(4행) 기준 한 칸 높이 계산
   */
  get frameHeight() {
    return this.imageHeight / 4;
  },
  /**
   * 캐릭터 발밑(Origin 1.0) 기준 이름표 표시 높이 계산
   * 프레임 전체 높이보다 약간 위(5px)에 위치하도록 설정
   */
  get labelOffsetY() {
    return this.frameHeight + 5;
  },
};
