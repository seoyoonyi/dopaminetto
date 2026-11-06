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

  private readonly scene: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Image;
  private readonly decoration: Phaser.GameObjects.Sprite;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly onOpenGuestbook: (position: { x: number; y: number }) => void;
  private destroyed = false;

  private readonly onPointerOver = () => this.hint.setVisible(true);

  private readonly onPointerOut = () => {
    this.hint.setVisible(false);
    this.scene.input.setDefaultCursor("default");
  };

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (pointer.downElement !== this.scene.game.canvas) return;

    this.hint.setVisible(false);
    this.scene.input.setDefaultCursor("default");
    const camera = this.scene.cameras.main;
    const canvasBounds = this.scene.game.canvas.getBoundingClientRect();
    const center = this.base.getCenter();
    const screenX = camera.x + (center.x - camera.worldView.x) * camera.zoom;
    const screenY = camera.y + (center.y - camera.worldView.y) * camera.zoom;
    this.onOpenGuestbook({
      x: canvasBounds.left + screenX * (canvasBounds.width / this.scene.scale.width),
      y: canvasBounds.top + screenY * (canvasBounds.height / this.scene.scale.height),
    });
  };

  constructor(
    scene: Phaser.Scene,
    effect: ChristmasTreeEffect,
    characterDepthBase: number,
    onOpenGuestbook: (position: { x: number; y: number }) => void = () => undefined,
  ) {
    this.scene = scene;
    this.onOpenGuestbook = onOpenGuestbook;

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

    this.base = scene.add
      .image(effect.x, effect.y, CHRISTMAS_TREE_BASE_ASSET_KEY)
      .setOrigin(0.5, 1)
      .setDepth(depth);
    this.base.setInteractive({ pixelPerfect: true, cursor: "pointer" });
    this.base.on("pointerover", this.onPointerOver);
    this.base.on("pointerout", this.onPointerOut);
    this.base.on("pointerdown", this.onPointerDown);

    this.hint = scene.add
      .text(
        effect.x,
        effect.y - CHRISTMAS_TREE_FRAME_HEIGHT - 8,
        "트리를 클릭하고\n크리스마스 카드를 남겨보세요!",
        {
          fontFamily: "galmuri9",
          fontSize: "14px",
          align: "center",
          color: "#ffffff",
          backgroundColor: "#00000088",
          padding: { x: 4, y: 2 },
        },
      )
      .setOrigin(0.5, 1)
      .setDepth(depth + 1)
      .setVisible(false);

    this.decoration = scene.add.sprite(effect.x, effect.y, CHRISTMAS_TREE_DECORATION_ASSET_KEY, 0);
    this.decoration.setOrigin(0.5, 1).setDepth(depth);
    this.decoration.play(CHRISTMAS_TREE_ANIMATION_KEY);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.base.off("pointerover", this.onPointerOver);
    this.base.off("pointerout", this.onPointerOut);
    this.base.off("pointerdown", this.onPointerDown);
    this.base.disableInteractive();
    this.scene.input.setDefaultCursor("default");
    this.hint.destroy();
    this.base.destroy();
    this.decoration.destroy();
  }
}
