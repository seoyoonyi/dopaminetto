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
    const base = createBase();
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
    const text = vi.fn(() => createHint());

    new ChristmasTreeEffectsController(
      { add: { image, sprite, text }, anims } as never,
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
          image: vi.fn(() => createBase()),
          sprite: vi.fn(() => decoration),
          text: vi.fn(() => createHint()),
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
          image: vi.fn(() => createBase()),
          sprite: vi.fn(() => decoration),
          text: vi.fn(() => createHint()),
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

  it("트리 본체만 픽셀 기준 클릭 영역과 호버 안내를 가진다", () => {
    const tree = createTreeHarness();

    new ChristmasTreeEffectsController(
      tree.scene as never,
      { id: 436, name: "christmas-tree", x: 734, y: 857 },
      1000,
      vi.fn(),
    );

    expect(tree.base.setInteractive).toHaveBeenCalledWith({
      pixelPerfect: true,
      cursor: "pointer",
    });
    expect(tree.hint.setVisible).toHaveBeenCalledWith(false);
    expect(tree.decoration.setInteractive).not.toHaveBeenCalled();
  });

  it("트리 호버 안내를 표시하고 클릭 위치와 무관하게 화면상 트리 중앙을 전달한다", () => {
    const tree = createTreeHarness();
    const onOpenGuestbook = vi.fn();

    new ChristmasTreeEffectsController(
      tree.scene as never,
      { id: 436, name: "christmas-tree", x: 734, y: 857 },
      1000,
      onOpenGuestbook,
    );

    tree.emit("pointerover");
    expect(tree.hint.setVisible).toHaveBeenLastCalledWith(true);

    tree.emit("pointerdown", {
      downElement: tree.scene.game.canvas,
      event: { clientX: 420, clientY: 280 },
    });
    expect(onOpenGuestbook).toHaveBeenCalledTimes(1);
    expect(onOpenGuestbook).toHaveBeenCalledWith({ x: 337, y: 249.25 });
    expect(tree.hint.setVisible).toHaveBeenLastCalledWith(false);
  });

  it("캔버스 밖 DOM을 누른 입력으로 트리 방명록을 열지 않는다", () => {
    const tree = createTreeHarness();
    const onOpenGuestbook = vi.fn();

    new ChristmasTreeEffectsController(
      tree.scene as never,
      { id: 436, name: "christmas-tree", x: 734, y: 857 },
      1000,
      onOpenGuestbook,
    );

    tree.emit("pointerdown", {
      downElement: {},
      event: { clientX: 420, clientY: 280 },
    });

    expect(onOpenGuestbook).not.toHaveBeenCalled();
  });

  it("호버 종료와 destroy에서 리스너·안내·커서를 정리한다", () => {
    const tree = createTreeHarness();
    const controller = new ChristmasTreeEffectsController(
      tree.scene as never,
      { id: 436, name: "christmas-tree", x: 734, y: 857 },
      1000,
      vi.fn(),
    );

    tree.emit("pointerover");
    tree.emit("pointerout");
    expect(tree.hint.setVisible).toHaveBeenLastCalledWith(false);
    expect(tree.input.setDefaultCursor).toHaveBeenCalledWith("default");

    controller.destroy();

    expect(tree.base.off).toHaveBeenCalledWith("pointerover", expect.any(Function));
    expect(tree.base.disableInteractive).toHaveBeenCalled();
    expect(tree.hint.destroy).toHaveBeenCalled();
    expect(tree.base.destroy).toHaveBeenCalled();
    expect(tree.decoration.destroy).toHaveBeenCalled();
    expect(tree.input.setDefaultCursor).toHaveBeenLastCalledWith("default");
  });
});

function createTreeHarness() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const base = {
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    getCenter: vi.fn(() => ({ x: 734, y: 678.5 })),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
      return base;
    }),
    off: vi.fn((event: string) => {
      handlers.delete(event);
      return base;
    }),
    disableInteractive: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
  const hint = {
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
  const decoration = {
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    play: vi.fn().mockReturnThis(),
    setInteractive: vi.fn(),
    destroy: vi.fn(),
  };
  const input = { setDefaultCursor: vi.fn() };

  return {
    base,
    hint,
    decoration,
    input,
    emit: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
    scene: {
      add: {
        image: vi.fn(() => base),
        sprite: vi.fn(() => decoration),
        text: vi.fn(() => hint),
      },
      cameras: { main: { x: 0, y: 0, zoom: 1, worldView: { x: 100, y: 200 } } },
      game: {
        canvas: {
          getBoundingClientRect: () => ({ left: 20, top: 10, width: 400, height: 300 }),
        },
      },
      scale: { width: 800, height: 600 },
      input,
      anims: {
        exists: vi.fn(() => true),
        create: vi.fn(),
        generateFrameNumbers: vi.fn(() => []),
      },
    },
  };
}

function createHint() {
  return {
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

function createBase() {
  return {
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    disableInteractive: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}
