import { describe, expect, it, vi } from "vitest";

import { ChristmasTreeEffectsController } from "./ChristmasTreeEffectsController";

describe("ChristmasTreeEffectsController", () => {
  it("320×357 트리 본체와 24프레임 장식 시트를 미리 불러온다", () => {
    const image = vi.fn();
    const spritesheet = vi.fn();

    ChristmasTreeEffectsController.preload({ load: { image, spritesheet } } as never);

    expect(image).toHaveBeenCalledWith(
      "christmas-tree-base",
      "/assets/images/christmas-tree-base.png",
    );
    expect(spritesheet).toHaveBeenCalledWith(
      "christmas-tree-decoration",
      "/assets/images/christmas-tree-decoration.png",
      { frameWidth: 320, frameHeight: 357 },
    );
  });

  it("트리 본체와 첫 장식 프레임을 승인된 바닥 깊이에 배치한다", () => {
    const base = { setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis() };
    const decoration = {
      setOrigin: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      play: vi.fn().mockReturnThis(),
    };
    const anims = {
      exists: vi.fn(() => true),
      create: vi.fn(),
      generateFrameNumbers: vi.fn(() => []),
    };
    const image = vi.fn(() => base);
    const sprite = vi.fn(() => decoration);

    new ChristmasTreeEffectsController(
      { add: { image, sprite }, anims } as never,
      { id: 436, name: "christmas-tree", x: 734, y: 857 },
      1000,
    );

    expect(image).toHaveBeenCalledWith(734, 857, "christmas-tree-base");
    expect(base.setOrigin).toHaveBeenCalledWith(0.5, 1);
    expect(sprite).toHaveBeenCalledWith(734, 857, "christmas-tree-decoration", 0);
    expect(decoration.setOrigin).toHaveBeenCalledWith(0.5, 1);
    expect(base.setDepth).toHaveBeenCalledWith(1857);
    expect(decoration.setDepth).toHaveBeenCalledWith(1857);
  });

  it("전구 점등 상태를 짧은 페이드와 함께 무한 반복 재생한다", () => {
    const frames = Array.from({ length: 24 }, (_, index) => index);
    const anims = {
      exists: vi.fn(() => false),
      create: vi.fn(),
      generateFrameNumbers: vi.fn(() => frames),
    };
    const decoration = {
      setOrigin: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      play: vi.fn().mockReturnThis(),
    };

    new ChristmasTreeEffectsController(
      {
        add: {
          image: vi.fn(() => ({ setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn() })),
          sprite: vi.fn(() => decoration),
        },
        anims,
      } as never,
      { id: 436, name: "christmas-tree", x: 734, y: 857 },
      1000,
    );

    expect(anims.generateFrameNumbers).toHaveBeenCalledWith("christmas-tree-decoration", {
      start: 0,
      end: 23,
    });
    expect(anims.create).toHaveBeenCalledWith({
      key: "christmas-tree-pulse",
      frames,
      frameRate: 1000 / 30,
      repeat: -1,
    });
    expect(decoration.play).toHaveBeenCalledWith("christmas-tree-pulse");
  });

  it("이미 등록된 전구 애니메이션은 다시 등록하지 않고 재생한다", () => {
    const anims = {
      exists: vi.fn(() => true),
      create: vi.fn(),
      generateFrameNumbers: vi.fn(),
    };
    const decoration = {
      setOrigin: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      play: vi.fn().mockReturnThis(),
    };

    new ChristmasTreeEffectsController(
      {
        add: {
          image: vi.fn(() => ({ setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn() })),
          sprite: vi.fn(() => decoration),
        },
        anims,
      } as never,
      { id: 436, name: "christmas-tree", x: 734, y: 857 },
      1000,
    );

    expect(anims.create).not.toHaveBeenCalled();
    expect(anims.generateFrameNumbers).not.toHaveBeenCalled();
    expect(decoration.play).toHaveBeenCalledWith("christmas-tree-pulse");
  });
});
