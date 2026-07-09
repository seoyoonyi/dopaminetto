import type { CharacterActionConfig, CharacterConfig, CharacterId } from "@/shared/types";

export const DEFAULT_CHARACTER_ID: CharacterId = "p-boy";
const ACTION_ATLAS_FRAME_WIDTH = 40;
const ACTION_ATLAS_FRAME_HEIGHT = 70;
const P_GIRL_ACTION_ATLAS_FRAME_WIDTH = 49;

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

/**
 * 캐릭터별 액션 스프라이트 에셋 정보 및 렌더링 규격 설정 상수
 */
export const CHARACTER_ACTION_CONFIGS = {
  "p-boy": {
    assetKey: "p-boy-actions",
    assetUrl: "/assets/images/p-boy-sprite-actions-final-s.png",
    frameWidth: ACTION_ATLAS_FRAME_WIDTH,
    frameHeight: ACTION_ATLAS_FRAME_HEIGHT,
    originY: 69 / ACTION_ATLAS_FRAME_HEIGHT,
    visibleHeight: 68,
  },
  "p-girl": {
    assetKey: "p-girl-actions",
    assetUrl: "/assets/images/p-girl-sprite-actions-final-s.png",
    frameWidth: P_GIRL_ACTION_ATLAS_FRAME_WIDTH,
    frameHeight: ACTION_ATLAS_FRAME_HEIGHT,
    originY: 69 / ACTION_ATLAS_FRAME_HEIGHT,
    visibleHeight: 63,
  },
} satisfies Record<CharacterId, CharacterActionConfig>;

const isCharacterId = (characterId?: string | null): characterId is CharacterId =>
  !!characterId && characterId in CHARACTER_CONFIGS;

export const resolveCharacterId = (characterId?: string | null): CharacterId => {
  if (isCharacterId(characterId)) {
    return characterId;
  }

  return DEFAULT_CHARACTER_ID;
};

export const getCharacterConfig = (characterId?: string | null): CharacterConfig =>
  CHARACTER_CONFIGS[resolveCharacterId(characterId)];
