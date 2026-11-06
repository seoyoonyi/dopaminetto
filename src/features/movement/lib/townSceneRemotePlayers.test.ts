// @vitest-environment jsdom
import type { MapLoader } from "@/entities/village";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useSettingsDialogStore } from "@/shared/store";
import { useGuestbookDialogStore } from "@/shared/store/useGuestbookDialogStore";
import { useNicknameDialogStore } from "@/shared/store/useNicknameDialogStore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RemotePlayer } from "../model/types";
import { makeScene, mockAmbientDestroy, mockSnowfall, shutdownScenes } from "./townSceneTestUtils";

vi.mock("./ChristmasTreeEffectsController", () => ({
  ChristmasTreeEffectsController: class {
    static preload() {}
    destroy() {}
  },
}));

function makeRemotePlayer(overrides: Partial<RemotePlayer> = {}): RemotePlayer {
  return {
    userId: "remote-user",
    nickname: "원격 사용자",
    characterId: "p-boy",
    position: { x: 20, y: 30 },
    villageId: "lobby",
    actionState: null,
    lastUpdatedAt: 0,
    ...overrides,
  };
}

describe("TownScene 원격 캐릭터 재시작", () => {
  beforeEach(() => {
    useMovementStore.setState({
      mapLoader: null,
      position: { x: 100, y: 200 },
      nickname: "로컬 사용자",
      characterId: "p-boy",
      userId: "local-user",
      remotePlayers: {
        "remote-user": makeRemotePlayer({ actionState: { actionId: "dance", sequence: 5 } }),
      },
    });
    useSettingsDialogStore.setState({ isOpen: false });
    useNicknameDialogStore.setState({ isOpen: false });
    useGuestbookDialogStore.setState({ isOpen: false });
    mockAmbientDestroy.mockClear();
    mockSnowfall.create.mockClear();
    mockSnowfall.destroy.mockClear();
  });

  afterEach(() => {
    shutdownScenes.splice(0).forEach((shutdown) => shutdown());
    useMovementStore.setState({ remotePlayers: {}, userId: "" });
    vi.restoreAllMocks();
  });

  it("빌리지 B에서도 맵 기반 눈 효과를 만들고 Scene 종료 때 정리한다", () => {
    const { scene, events } = makeScene();
    const mapLoader = {
      getBackgroundImage: () => ({ visible: false }),
      getFrontImage: () => ({ visible: false }),
      getMapBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
      getVillageAreas: () => [],
      getChristmasTreeEffect: () => undefined,
    } as unknown as MapLoader;
    useMovementStore.setState({ mapLoader, villageId: "village-b" });

    scene.create();
    expect(mockSnowfall.create).toHaveBeenCalledWith(scene, mapLoader);

    scene.update(0, 16);

    events.emit("shutdown");
    expect(mockSnowfall.destroy).toHaveBeenCalledOnce();
  });

  it("원격 캐릭터 이름표도 캐릭터와 같은 깊이로 정렬한다", () => {
    const { scene, sprites, labels } = makeScene();

    scene.create();

    expect(labels[1].depth).toBe(sprites[1].depth);
  });

  it("Scene 재시작 후 같은 사용자의 새 액션 sequence를 다시 표시한다", () => {
    const { scene, sprites, events } = makeScene();
    shutdownScenes.push(() => events.emit("shutdown"));

    scene.create();
    const firstRemoteSprite = sprites[1];
    expect(firstRemoteSprite.anims?.play).toHaveBeenCalled();

    events.emit("shutdown");
    useMovementStore.setState({
      remotePlayers: {
        "remote-user": {
          ...useMovementStore.getState().remotePlayers["remote-user"],
          actionState: { actionId: "dance", sequence: 1 },
        },
      },
    });

    scene.create();
    const restartedRemoteSprite = sprites[3];

    expect(restartedRemoteSprite.anims?.play).toHaveBeenCalled();
  });

  it("로컬 사용자를 원격으로 중복 표시하지 않고 위치 수신 뒤 원격 캐릭터를 한 번 생성한다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const missingPosition = {
      ...makeRemotePlayer(),
      position: undefined,
    } as unknown as RemotePlayer;
    useMovementStore.setState({
      remotePlayers: {
        "local-user": makeRemotePlayer({ userId: "local-user" }),
        "remote-user": missingPosition,
      },
    });
    const { scene, sprites, labels, events } = makeScene();
    shutdownScenes.push(() => events.emit("shutdown"));

    scene.create();

    expect(sprites).toHaveLength(1);
    expect(warn).toHaveBeenCalledOnce();

    useMovementStore.setState({
      remotePlayers: { "remote-user": makeRemotePlayer({ position: { x: 20, y: 30 } }) },
    });
    useMovementStore.setState({
      remotePlayers: { "remote-user": makeRemotePlayer({ position: { x: 20, y: 30 } }) },
    });

    expect(sprites).toHaveLength(2);
    expect(labels[1].text).toBe("원격 사용자");
  });

  it("원격 사용자 이탈 시 표시를 제거하고 재입장 때 새 표시를 만든다", () => {
    useMovementStore.setState({ remotePlayers: { "remote-user": makeRemotePlayer() } });
    const { scene, sprites, labels, events } = makeScene();
    shutdownScenes.push(() => events.emit("shutdown"));

    scene.create();
    const departedSprite = sprites[1];
    const departedLabel = labels[1];

    useMovementStore.setState({ remotePlayers: {} });
    expect(departedSprite.destroyed).toBe(true);
    expect(departedLabel.destroyed).toBe(true);

    useMovementStore.setState({ remotePlayers: { "remote-user": makeRemotePlayer() } });

    expect(sprites).toHaveLength(3);
    expect(sprites[2]).not.toBe(departedSprite);
  });

  it("같은 빌리지에서는 보간하고 빌리지 변경이나 긴 프레임에서는 목표 위치에 맞춘다", () => {
    useMovementStore.setState({ remotePlayers: { "remote-user": makeRemotePlayer() } });
    const { scene, sprites, events } = makeScene();
    shutdownScenes.push(() => events.emit("shutdown"));
    scene.create();
    const remoteSprite = sprites[1];

    scene.update(0, 16);
    useMovementStore.setState({
      remotePlayers: {
        "remote-user": makeRemotePlayer({ position: { x: 120, y: 30 } }),
      },
    });
    scene.update(0, 16);
    expect(remoteSprite.x).toBeGreaterThan(20);
    expect(remoteSprite.x).toBeLessThan(120);

    useMovementStore.setState({
      remotePlayers: {
        "remote-user": makeRemotePlayer({
          position: { x: 300, y: 400 },
          villageId: "village-a",
        }),
      },
    });
    scene.update(0, 16);
    expect(remoteSprite.x).toBe(300);
    expect(remoteSprite.y).toBe(400);

    useMovementStore.setState({
      remotePlayers: {
        "remote-user": makeRemotePlayer({
          position: { x: 500, y: 600 },
          villageId: "village-a",
        }),
      },
    });
    scene.update(0, 251);
    expect(remoteSprite.x).toBe(500);
    expect(remoteSprite.y).toBe(600);
  });

  it("액션 중 이름표를 갱신하고 종료 시 최신 캐릭터로 복원한다", () => {
    useMovementStore.setState({ remotePlayers: { "remote-user": makeRemotePlayer() } });
    const { scene, sprites, labels, events } = makeScene();
    shutdownScenes.push(() => events.emit("shutdown"));
    scene.create();
    const remoteSprite = sprites[1];
    const remoteLabel = labels[1];

    useMovementStore.setState({
      remotePlayers: {
        "remote-user": makeRemotePlayer({ actionState: { actionId: "dance", sequence: 1 } }),
      },
    });
    const actionTexture = remoteSprite.texture?.key;

    useMovementStore.setState({
      remotePlayers: {
        "remote-user": makeRemotePlayer({
          nickname: "바뀐 이름",
          characterId: "p-girl",
          actionState: { actionId: "dance", sequence: 1 },
        }),
      },
    });

    expect(remoteLabel.text).toBe("바뀐 이름");
    expect(remoteSprite.texture?.key).toBe(actionTexture);
    expect(remoteSprite.anims?.play).toHaveBeenCalledTimes(1);

    useMovementStore.setState({
      remotePlayers: {
        "remote-user": makeRemotePlayer({ nickname: "바뀐 이름", characterId: "p-girl" }),
      },
    });

    expect(remoteSprite.texture?.key).not.toBe(actionTexture);
  });

  it("Game destroy 경로에서 Scene 자원을 정리하고 이후 스토어 변경을 받지 않는다", () => {
    const { scene, events, sprites } = makeScene();
    const otherShutdownListener = vi.fn();
    const otherDestroyListener = vi.fn();
    events.on("shutdown", otherShutdownListener);
    events.on("destroy", otherDestroyListener);
    scene.create();
    Object.assign(scene, { christmasTreeAmbientController: { destroy: mockAmbientDestroy } });
    const localSprite = sprites[0];

    events.emit("destroy");
    useMovementStore.setState({ position: { x: 150, y: 250 } });

    expect(mockAmbientDestroy).toHaveBeenCalledOnce();
    expect(localSprite.x).toBe(100);
    expect(events.listenerCount("shutdown")).toBe(1);
    expect(events.listenerCount("destroy")).toBe(1);

    events.emit("shutdown");
    expect(otherShutdownListener).toHaveBeenCalledOnce();
    expect(otherDestroyListener).toHaveBeenCalledOnce();
  });

  it("shutdown 후 재시작하고 destroy해도 각 실행의 자원을 한 번씩 정리한다", () => {
    const { scene, events } = makeScene();
    scene.create();
    Object.assign(scene, { christmasTreeAmbientController: { destroy: mockAmbientDestroy } });
    events.emit("shutdown");

    expect(mockAmbientDestroy).toHaveBeenCalledTimes(1);
    expect(events.listenerCount("destroy")).toBe(1);

    scene.create();
    Object.assign(scene, { christmasTreeAmbientController: { destroy: mockAmbientDestroy } });
    events.emit("destroy");

    expect(mockAmbientDestroy).toHaveBeenCalledTimes(2);
    expect(events.listenerCount("shutdown")).toBe(0);
    expect(events.listenerCount("destroy")).toBe(0);
  });

  it("초기화 도중 실패한 뒤 destroy해도 먼저 생성된 카메라 자원을 정리한다", () => {
    const { scene, events } = makeScene();
    const mapLoader = {
      getBackgroundImage: () => ({ visible: false }),
      getFrontImage: () => ({ visible: false }),
      getMapBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    } as unknown as MapLoader;
    useMovementStore.setState({ mapLoader });
    vi.spyOn(scene.add, "text").mockImplementation(() => {
      throw new Error("이름표 생성 실패");
    });

    expect(() => scene.create()).toThrow("이름표 생성 실패");
    events.emit("destroy");

    expect(scene.scale.on).toHaveBeenCalledOnce();
    expect(scene.scale.off).toHaveBeenCalledOnce();
    expect(mockAmbientDestroy).not.toHaveBeenCalled();
  });
});
