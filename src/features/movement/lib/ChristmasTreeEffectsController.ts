import type { ChristmasTreeEffect } from "@/entities/village";
import * as Phaser from "phaser";

export const CHRISTMAS_TREE_BASE_ASSET_KEY = "christmas-tree-base";
export const CHRISTMAS_TREE_BASE_ASSET_URL = "/assets/images/christmas-tree-base.png";
export const CHRISTMAS_TREE_DECORATION_ASSET_KEY = "christmas-tree-decoration";
export const CHRISTMAS_TREE_DECORATION_ASSET_URL = "/assets/images/christmas-tree-decoration.png";
export const CHRISTMAS_TREE_FRAME_WIDTH = 320;
export const CHRISTMAS_TREE_FRAME_HEIGHT = 357;

const CHRISTMAS_TREE_ANIMATION_KEY = "christmas-tree-pulse";
const CHRISTMAS_TREE_ANIMATION_FRAME_COUNT = 24;
const CHRISTMAS_TREE_ANIMATION_FRAME_RATE = 1000 / 30;

/** 로비 트리 본체와 반복 애니메이션 장식 레이어를 같은 기준점에 렌더링한다. */
export class ChristmasTreeEffectsController {
  static preload(scene: Phaser.Scene): void {
    scene.load.image(CHRISTMAS_TREE_BASE_ASSET_KEY, CHRISTMAS_TREE_BASE_ASSET_URL);
    scene.load.spritesheet(
      CHRISTMAS_TREE_DECORATION_ASSET_KEY,
      CHRISTMAS_TREE_DECORATION_ASSET_URL,
      {
        frameWidth: CHRISTMAS_TREE_FRAME_WIDTH,
        frameHeight: CHRISTMAS_TREE_FRAME_HEIGHT,
      },
    );
  }

  constructor(scene: Phaser.Scene, effect: ChristmasTreeEffect, characterDepthBase: number) {
    if (!scene.anims.exists(CHRISTMAS_TREE_ANIMATION_KEY)) {
      scene.anims.create({
        key: CHRISTMAS_TREE_ANIMATION_KEY,
        frames: scene.anims.generateFrameNumbers(CHRISTMAS_TREE_DECORATION_ASSET_KEY, {
          start: 0,
          end: CHRISTMAS_TREE_ANIMATION_FRAME_COUNT - 1,
        }),
        frameRate: CHRISTMAS_TREE_ANIMATION_FRAME_RATE,
        repeat: -1,
      });
    }

    const depth = characterDepthBase + effect.y;

    scene.add
      .image(effect.x, effect.y, CHRISTMAS_TREE_BASE_ASSET_KEY)
      .setOrigin(0.5, 1)
      .setDepth(depth);

    const decoration = scene.add.sprite(effect.x, effect.y, CHRISTMAS_TREE_DECORATION_ASSET_KEY, 0);
    decoration.setOrigin(0.5, 1).setDepth(depth);
    decoration.play(CHRISTMAS_TREE_ANIMATION_KEY);
  }
}
