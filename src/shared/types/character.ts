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
