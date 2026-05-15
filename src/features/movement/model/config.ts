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
 * 선택 가능한 캐릭터 식별자
 */
export type CharacterId = "p-boy" | "p-girl";

export interface CharacterConfig {
  id: CharacterId;
  name: string;
  assetKey: string;
  assetUrl: string;
  previewAssetUrl: string;
  previewImageWidth: number;
  previewImageHeight: number;
  imageWidth: number;
  imageHeight: number;
  scale: number;
  originY: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly labelOffsetY: number;
}

export const DEFAULT_CHARACTER_ID: CharacterId = "p-boy";

const createCharacterConfig = ({
  id,
  name,
  assetKey,
  assetUrl,
  previewAssetUrl,
  previewImageWidth,
  previewImageHeight,
  imageWidth,
  imageHeight,
  scale = 1,
  originY = 1,
}: Omit<CharacterConfig, "frameWidth" | "frameHeight" | "labelOffsetY">): CharacterConfig => ({
  id,
  name,
  assetKey,
  assetUrl,
  previewAssetUrl,
  previewImageWidth,
  previewImageHeight,
  imageWidth,
  imageHeight,
  scale,
  originY,

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
    return this.frameHeight * this.scale + 5;
  },
});

/**
 * 캐릭터 스프라이트 에셋 정보 및 렌더링 규격 설정 상수
 */
export const CHARACTER_CONFIGS = {
  "p-boy": createCharacterConfig({
    id: "p-boy",
    name: "캐릭터1",
    assetKey: "p-boy-sprite",
    assetUrl: "/assets/images/p-boy-sprite-s.png",
    previewAssetUrl: "/assets/images/characters/previews/p-boy.webp",
    previewImageWidth: 169,
    previewImageHeight: 312,
    imageWidth: 120,
    imageHeight: 280,
    scale: 1,
    originY: 1,
  }),
  "p-girl": createCharacterConfig({
    id: "p-girl",
    name: "캐릭터2",
    assetKey: "p-girl-sprite",
    assetUrl: "/assets/images/p-girl-sprite-s.png",
    previewAssetUrl: "/assets/images/characters/previews/p-girl.webp",
    previewImageWidth: 236,
    previewImageHeight: 341,
    imageWidth: 147,
    imageHeight: 252,
    scale: 1,
    originY: 1,
  }),
} satisfies Record<CharacterId, CharacterConfig>;

export const CHARACTER_OPTIONS = Object.values(CHARACTER_CONFIGS);

export const resolveCharacterId = (characterId?: string | null): CharacterId => {
  if (characterId === "p-boy" || characterId === "p-girl") {
    return characterId;
  }

  return DEFAULT_CHARACTER_ID;
};

export const getCharacterConfig = (characterId?: string | null): CharacterConfig =>
  CHARACTER_CONFIGS[resolveCharacterId(characterId)];

export const CHARACTER_CONFIG = CHARACTER_CONFIGS[DEFAULT_CHARACTER_ID];
