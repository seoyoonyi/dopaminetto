import type { CharacterConfig } from "@/shared/types";
import type * as Phaser from "phaser";

export function getAnimationKey(character: CharacterConfig, animationKey: string): string {
  return `${character.assetKey}-${animationKey}`;
}

export function applyCharacterConfig(
  sprite: Phaser.GameObjects.Sprite,
  characterConfig: CharacterConfig,
): void {
  sprite.setTexture(characterConfig.assetKey, sprite.frame.name);
  sprite.setScale(characterConfig.scale);
  sprite.setOrigin(0.5, characterConfig.originY); // 캐릭터별 발밑 기준 정렬을 유지한다.
}
