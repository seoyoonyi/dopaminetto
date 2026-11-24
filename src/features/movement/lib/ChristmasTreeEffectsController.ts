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
const CHRISTMAS_TREE_HOVER_GLOW_COLOR = 0xffd28a;
const CHRISTMAS_TREE_HOVER_GLOW_STRENGTH = 5;
const CHRISTMAS_TREE_HOVER_GLOW_PADDING = 16;

const TOOLTIP_TEXT = "트리를 클릭하고\n❤️ 크리스마스 카드를 남겨보세요!";
const TOOLTIP_GAP_ABOVE_TREE = 8;
const TOOLTIP_PADDING_X = 12;
const TOOLTIP_PADDING_Y = 12;
const TOOLTIP_RADIUS = 10;
const TOOLTIP_TAIL_WIDTH = 14;
const TOOLTIP_TAIL_HEIGHT = 8;
const TOOLTIP_BORDER_WIDTH = 2;
const TOOLTIP_FILL_COLOR = 0xfff8e7;
const TOOLTIP_BORDER_COLOR = 0x8b5a2b;
const TOOLTIP_SHADOW_COLOR = 0x5a3417;
/** 블러 대신 넓고 옅은 층 위에 좁고 조금 진한 층을 겹쳐 가장자리를 부드럽게 만든다. */
const TOOLTIP_SHADOW_LAYERS = [
  { offsetY: 3, spread: 1, alpha: 0.06 },
  { offsetY: 2, spread: 0, alpha: 0.1 },
];
/**
 * Galmuri9는 10px 격자 폰트라 10px이 가장 날카롭지만 획이 1px로 얇아진다.
 * 13px의 살짝 번진 가장자리가 말풍선에 어울리는 도톰한 픽셀 느낌을 주므로 13px을 유지한다.
 */
const TOOLTIP_FONT_SIZE = "13px";
const TOOLTIP_TEXT_COLOR = "#5b3a1e";

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
  private readonly hint: Phaser.GameObjects.Container;
  /** WebGL이 아니면 preFX가 없으므로 glow 없이 기존 인터랙션만 유지한다. */
  private readonly glow?: Phaser.FX.Glow;
  private readonly onOpenGuestbook: (position: { x: number; y: number }) => void;
  private destroyed = false;

  private readonly onPointerOver = () => {
    this.glow?.setActive(true);
    this.hint.setVisible(true);
  };

  private readonly onPointerOut = () => {
    this.glow?.setActive(false);
    this.hint.setVisible(false);
    this.scene.input.setDefaultCursor("default");
  };

  private readonly onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (pointer.downElement !== this.scene.game.canvas) return;

    this.glow?.setActive(false);
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
    // 호버마다 만들지 않도록 glow는 한 번만 생성하고 활성 상태만 토글한다.
    this.base.preFX?.setPadding(CHRISTMAS_TREE_HOVER_GLOW_PADDING);
    this.glow = this.base.preFX?.addGlow(
      CHRISTMAS_TREE_HOVER_GLOW_COLOR,
      CHRISTMAS_TREE_HOVER_GLOW_STRENGTH,
    );
    this.glow?.setActive(false);
    this.base.setInteractive({ pixelPerfect: true, cursor: "pointer" });
    this.base.on("pointerover", this.onPointerOver);
    this.base.on("pointerout", this.onPointerOut);
    this.base.on("pointerdown", this.onPointerDown);

    this.hint = createHoverTooltip(
      scene,
      effect.x,
      effect.y - CHRISTMAS_TREE_FRAME_HEIGHT - TOOLTIP_GAP_ABOVE_TREE,
    )
      .setDepth(depth + 1)
      .setVisible(false);

    this.decoration = scene.add.sprite(effect.x, effect.y, CHRISTMAS_TREE_DECORATION_ASSET_KEY, 0);
    this.decoration.setOrigin(0.5, 1).setDepth(depth);
    this.decoration.play(CHRISTMAS_TREE_ANIMATION_KEY);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    // scene shutdown 시 DisplayList가 먼저 오브젝트를 파괴하므로 base.scene이 없을 수 있다.
    // Container.destroy()는 말풍선 Graphics·Text 자식까지 함께 파괴한다.
    // GameObject.destroy()가 리스너·인터랙션·커서·preFX(glow) 정리를 담당하고, 중복 호출은 무시된다.
    this.hint.destroy();
    this.base.destroy();
    this.decoration.destroy();
  }
}

/**
 * 트리 위에 뜨는 아이보리 말풍선 안내를 만든다.
 * Container 원점(x, y)이 꼬리 끝이며, 말풍선은 그 위쪽으로 그려진다.
 */
function createHoverTooltip(scene: Phaser.Scene, x: number, y: number) {
  const bottom = -TOOLTIP_TAIL_HEIGHT;
  const text = scene.add
    .text(0, bottom - TOOLTIP_PADDING_Y, TOOLTIP_TEXT, {
      fontFamily: "galmuri9",
      fontSize: TOOLTIP_FONT_SIZE,
      align: "center",
      color: TOOLTIP_TEXT_COLOR,
      lineSpacing: 4,
    })
    .setOrigin(0.5, 1);

  const width = Math.ceil(text.width) + TOOLTIP_PADDING_X * 2;
  const height = Math.ceil(text.height) + TOOLTIP_PADDING_Y * 2;
  const left = -width / 2;
  const top = bottom - height;
  const tailHalf = TOOLTIP_TAIL_WIDTH / 2;

  const bubble = scene.add.graphics();
  for (const { offsetY, spread, alpha } of TOOLTIP_SHADOW_LAYERS) {
    bubble.fillStyle(TOOLTIP_SHADOW_COLOR, alpha);
    bubble.fillRoundedRect(
      left - spread,
      top + offsetY - spread,
      width + spread * 2,
      height + spread * 2,
      TOOLTIP_RADIUS + spread,
    );
    bubble.fillTriangle(
      -tailHalf - spread,
      bottom + offsetY,
      tailHalf + spread,
      bottom + offsetY,
      0,
      offsetY + spread,
    );
  }
  // 본체: 아이보리 둥근 박스와 갈색 테두리.
  bubble.fillStyle(TOOLTIP_FILL_COLOR, 1);
  bubble.lineStyle(TOOLTIP_BORDER_WIDTH, TOOLTIP_BORDER_COLOR, 1);
  bubble.fillRoundedRect(left, top, width, height, TOOLTIP_RADIUS);
  bubble.strokeRoundedRect(left, top, width, height, TOOLTIP_RADIUS);
  // 꼬리: 박스 아래 테두리를 덮어 이음새를 없앤 뒤 양 옆 선만 다시 긋는다.
  bubble.fillTriangle(
    -tailHalf,
    bottom - TOOLTIP_BORDER_WIDTH,
    tailHalf,
    bottom - TOOLTIP_BORDER_WIDTH,
    0,
    0,
  );
  bubble.lineBetween(-tailHalf, bottom, 0, 0);
  bubble.lineBetween(tailHalf, bottom, 0, 0);

  return scene.add.container(x, y, [bubble, text]);
}
