import type { CharacterConfig } from "@/shared/types";
import type * as Phaser from "phaser";

const CHARACTER_DEPTH_BASE = 1000;
const NAME_LABEL_DEPTH_BASE = 9000;

export function getAnimationKey(character: CharacterConfig, animationKey: string): string {
  return `${character.assetKey}-${animationKey}`;
}

/** 캐릭터 발밑 좌표를 기준으로 캐릭터와 이름표의 렌더링 순서를 맞춘다. */
export function syncCharacterDepth(
  sprite: Phaser.GameObjects.Sprite,
  nameLabel?: Phaser.GameObjects.Text,
): void {
  sprite.setDepth(CHARACTER_DEPTH_BASE + sprite.y);
  nameLabel?.setDepth(NAME_LABEL_DEPTH_BASE + sprite.y);
}

export function applyCharacterConfig(
  sprite: Phaser.GameObjects.Sprite,
  characterConfig: CharacterConfig,
): void {
  sprite.setTexture(characterConfig.assetKey, sprite.frame.name);
  sprite.setScale(characterConfig.scale);
  sprite.setOrigin(0.5, characterConfig.originY); // 캐릭터별 발밑 기준 정렬을 유지한다.
}
