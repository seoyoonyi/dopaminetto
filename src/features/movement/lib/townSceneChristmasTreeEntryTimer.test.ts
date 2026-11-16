// @vitest-environment jsdom
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useSettingsDialogStore } from "@/shared/store";
import { useGuestbookDialogStore } from "@/shared/store/useGuestbookDialogStore";
import { useNicknameDialogStore } from "@/shared/store/useNicknameDialogStore";
import type * as Phaser from "phaser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeScene, mockAmbient, shutdownScenes } from "./townSceneTestUtils";

// "phaser" 루트는 townSceneTestUtils가 mock하므로 실제 구현은 소스 경로에서 불러온다.
const { default: Clock } = await vi.importActual<{ default: typeof Phaser.Time.Clock }>(
  "phaser/src/time/Clock",
);
const { default: EventEmitter } = await vi.importActual<{
  default: typeof Phaser.Events.EventEmitter;
}>("phaser/src/events/EventEmitter");

/** 실제 Clock을 붙인 TownScene과 프레임 진행 함수(step)를 만든다. */
function createSceneWithRealClock() {
  const { scene } = makeScene();
  const events = new EventEmitter();
  const sound = { pauseOnBlur: true };

  Object.assign(scene, {
    events,
    sys: { events, game: { loop: { time: 0 } } },
    cache: { audio: { exists: () => true } },
    sound,
  });

  const clock = new Clock(scene as unknown as Phaser.Scene);
  Object.assign(scene, { time: clock });
  const delayedCall = vi.spyOn(clock, "delayedCall");

  events.emit("boot");
  events.emit("start");
  scene.create();

  let now = 0;
  const step = (delta: number) => {
    now += delta;
    events.emit("preupdate", now, delta);
    events.emit("update", now, delta);
    scene.update(now, delta);
  };

  const timer = delayedCall.mock.results[0].value as Phaser.Time.TimerEvent;

  return { events, clock, timer, step, sound };
}

describe("TownScene 캐롤 지연 타이머 (실제 Phaser Clock)", () => {
  let activeEvents: Phaser.Events.EventEmitter | undefined;

  beforeEach(() => {
    mockAmbient.create.mockClear();
    mockAmbient.resolveSources.mockReturnValueOnce([
      { id: "christmas-tree-436", villageId: "lobby", x: 734, y: 857 },
    ]);
    useMovementStore.setState({
      mapLoader: {
        getBackgroundImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getFrontImage: () => ({ visible: false, x: 0, y: 0, width: 1448, height: 1086 }),
        getMapBounds: () => ({ x: 0, y: 0, width: 1448, height: 1086 }),
        getChristmasTreeEffect: () => undefined,
      } as never,
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
    activeEvents?.emit("shutdown");
    activeEvents = undefined;
    shutdownScenes.splice(0).forEach((shutdown) => shutdown());
    useMovementStore.setState({ mapLoader: null, remotePlayers: {}, userId: "" });
    vi.restoreAllMocks();
  });

  it("씬을 유지하면 1,999ms에는 컨트롤러가 없고 2,000ms에 한 번만 만든다", () => {
    const { events, timer, step } = createSceneWithRealClock();
    activeEvents = events;

    expect(timer.delay).toBe(2000);

    step(1000);
    step(999);
    expect(mockAmbient.create).not.toHaveBeenCalled();

    step(1);
    expect(mockAmbient.create).toHaveBeenCalledOnce();

    step(1000);
    step(1000);
    expect(mockAmbient.create).toHaveBeenCalledOnce();
  });

  it("지연 대기 중 blur로 오디오가 멈추지 않도록 입장 시점에 pauseOnBlur를 끈다", () => {
    const { events, sound } = createSceneWithRealClock();
    activeEvents = events;

    expect(mockAmbient.create).not.toHaveBeenCalled();
    expect(sound.pauseOnBlur).toBe(false);
  });

  it.each(["shutdown", "destroy"])(
    "1초 시점에 %s가 발생하면 예약된 타이머를 정리하고 컨트롤러를 만들지 않는다",
    (sceneEvent) => {
      const { events, clock, timer, step } = createSceneWithRealClock();
      const destroyTimer = vi.spyOn(timer, "destroy");

      step(1000);
      expect(timer.elapsed).toBe(1000);
      expect(timer.callback).toEqual(expect.any(Function));

      events.emit(sceneEvent);

      // 타이머 자체가 정리됐는지 확인한다.
      expect(destroyTimer).toHaveBeenCalledOnce();
      expect(timer.callback).toBeUndefined();

      // 구독이 끊긴 뒤 Clock을 직접 돌려도 콜백이 실행되지 않는다.
      step(1000);
      step(1000);
      clock.preUpdate(5000, 3000);
      clock.update(5000, 3000);

      expect(timer.hasDispatched).toBe(false);
      expect(mockAmbient.create).not.toHaveBeenCalled();
    },
  );
});
