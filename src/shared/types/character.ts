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

/**
 * 로컬 액션 스프라이트 atlas의 로딩 및 렌더링 기준값
 */
export interface CharacterActionConfig {
  assetKey: string;
  assetUrl: string;
  frameWidth: number;
  frameHeight: number;
  originY: number;
  visibleHeight: number;
}
