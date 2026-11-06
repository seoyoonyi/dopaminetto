// @vitest-environment jsdom
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useSettingsDialogStore } from "@/shared/store";
import { useGuestbookDialogStore } from "@/shared/store/useGuestbookDialogStore";
import { useNicknameDialogStore } from "@/shared/store/useNicknameDialogStore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeScene, shutdownScenes } from "./townSceneTestUtils";

describe("TownScene 크리스마스 트리 연동", () => {
  beforeEach(() => {
    useMovementStore.setState({
      mapLoader: null,
      position: { x: 100, y: 200 },
      nickname: "로컬 사용자",
      characterId: "p-boy",
      userId: "local-user",
      remotePlayers: {},
    });
    useSettingsDialogStore.setState({ isOpen: false });
    useNicknameDialogStore.setState({ isOpen: false });
    useGuestbookDialogStore.setState({ isOpen: false });
  });

  afterEach(() => {
    shutdownScenes.splice(0).forEach((shutdown) => shutdown());
    useMovementStore.setState({ remotePlayers: {}, userId: "" });
    vi.restoreAllMocks();
  });

  it("트리 본체와 24프레임 장식 시트를 미리 불러온다", () => {
    const { scene } = makeScene();

    scene.preload();

    expect(scene.load.image).toHaveBeenCalledWith(
      "christmas-tree-base",
      "/assets/images/christmas-tree-base.png",
    );
    expect(scene.load.spritesheet).toHaveBeenCalledWith(
      "christmas-tree-decoration",
      "/assets/images/christmas-tree-decoration.png",
      { frameWidth: 320, frameHeight: 357 },
    );
  });

  it("승인된 맵 위치에 트리 본체와 첫 장식 프레임을 표시한다", () => {
    useMovementStore.setState({
      mapLoader: {
        getBackgroundImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getFrontImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getMapBounds: () => ({ x: 0, y: 0, width: 1448, height: 1086 }),
        getChristmasTreeEffect: () => ({ id: 436, name: "christmas-tree", x: 734, y: 857 }),
      } as never,
    });
    const { scene } = makeScene();

    scene.create();

    expect(scene.add.image).toHaveBeenCalledWith(734, 857, "christmas-tree-base");
    expect(scene.add.sprite).toHaveBeenCalledWith(734, 857, "christmas-tree-decoration", 0);
  });

  it("트리 클릭으로 방명록 상태를 열고 Scene 종료 시 상태와 트리 객체를 정리한다", () => {
    useMovementStore.setState({
      mapLoader: {
        getBackgroundImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getFrontImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getMapBounds: () => ({ x: 0, y: 0, width: 1448, height: 1086 }),
        getChristmasTreeEffect: () => ({ id: 436, name: "christmas-tree", x: 734, y: 857 }),
      } as never,
    });
    const { scene, events, images, sprites } = makeScene();

    scene.create();
    const treeBase = images.find((image) => image.texture?.key === "christmas-tree-base");
    const treeDecoration = sprites.find(
      (sprite) => sprite.texture?.key === "christmas-tree-decoration",
    );
    expect(treeBase).toBeDefined();
    expect(treeDecoration).toBeDefined();

    treeBase?.emit("pointerdown", {
      downElement: scene.game.canvas,
      event: { clientX: 734, clientY: 857 },
    });
    expect(useGuestbookDialogStore.getState().isOpen).toBe(true);

    events.emit("shutdown");
    events.emit("destroy");

    expect(useGuestbookDialogStore.getState().isOpen).toBe(false);
    expect(treeBase?.destroy).toHaveBeenCalledOnce();
    expect(treeDecoration?.destroy).toHaveBeenCalledOnce();
  });

  it("설정 다이얼로그가 열린 동안 트리를 눌러도 방명록을 열지 않는다", () => {
    useMovementStore.setState({
      mapLoader: {
        getBackgroundImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getFrontImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getMapBounds: () => ({ x: 0, y: 0, width: 1448, height: 1086 }),
        getChristmasTreeEffect: () => ({ id: 436, name: "christmas-tree", x: 734, y: 857 }),
      } as never,
    });
    useSettingsDialogStore.setState({ isOpen: true });
    const { scene, images } = makeScene();

    scene.create();
    const treeBase = images.find((image) => image.texture?.key === "christmas-tree-base");
    treeBase?.emit("pointerdown", {
      downElement: scene.game.canvas,
      event: { clientX: 734, clientY: 857 },
    });

    expect(useGuestbookDialogStore.getState().isOpen).toBe(false);
  });
});
