// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { AmbientSoundController } from "./AmbientSoundController";

// jsdom에 Web Audio가 없고 Phaser 전체는 canvas 미지원으로 초기화가 실패한다.
// Controller가 런타임에 쓰는 Phaser.Math 순수 함수만 실제 계산으로 대체한다.
vi.mock("phaser", () => ({
  Math: {
    Clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
    Linear: (p0: number, p1: number, t: number) => (p1 - p0) * t + p0,
    Distance: {
      Between: (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1),
    },
  },
}));

const SOURCE = { id: "campfire", villageId: "village-a" as const, x: 400, y: 400 };
const INSIDE = { x: 400, y: 400 };
const OUTSIDE = { x: 6000, y: 400 };
// volumeSmoothingRate * delta(1000) >= 1 이라 첫 프레임에 target volume으로 스냅된다.
const FALLOFF = { innerRadius: 100, outerRadius: 300, maxVolume: 1, volumeSmoothingRate: 1 };

const controllers: AmbientSoundController[] = [];

function makeGain() {
  return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
}

function makeBufferSource() {
  return {
    buffer: null as unknown,
    loop: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function setup(sources = [SOURCE]) {
  const nodes: ReturnType<typeof makeBufferSource>[] = [];
  const gains: ReturnType<typeof makeGain>[] = [];
  const buffer = { duration: 44 };
  const destination = { id: "destination" };
  const context = {
    state: "running" as AudioContextState,
    resume: vi.fn(() => Promise.resolve()),
    createGain: () => {
      const gain = makeGain();
      gains.push(gain);
      return gain;
    },
    createBufferSource: () => {
      const node = makeBufferSource();
      nodes.push(node);
      return node;
    },
  };
  const scene = {
    sound: { context, destination, pauseOnBlur: true },
    cache: { audio: { get: () => buffer } },
    game: { loop: { delta: 1000 } },
  };
  const controller = new AmbientSoundController(
    scene as never,
    "ambient-campfire",
    sources,
    FALLOFF,
  );
  controllers.push(controller);
  return { controller, context, nodes, gains, buffer, destination };
}

afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.destroy());
  vi.restoreAllMocks();
});

describe("AmbientSoundController", () => {
  it("가청 범위 진입 시 duration 없는 loop 노드를 하나 만들고, 반복 update에도 중복 생성하지 않는다", () => {
    const { controller, nodes, gains, buffer, destination } = setup();

    controller.update(OUTSIDE, "village-a");
    expect(nodes).toHaveLength(0);

    controller.update(INSIDE, "village-a");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].buffer).toBe(buffer);
    expect(nodes[0].loop).toBe(true);
    expect(nodes[0].start).toHaveBeenCalledWith();
    expect(nodes[0].connect).toHaveBeenCalledWith(gains[0]);
    expect(gains[0].connect).toHaveBeenCalledWith(destination);
    expect(gains[0].gain.value).toBe(1);

    controller.update(INSIDE, "village-a");
    controller.update(INSIDE, "village-a");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].start).toHaveBeenCalledTimes(1);
  });

  it("범위 이탈 시 한 번만 정리하고, 재진입 시 새 노드를 만들며, 다른 village도 같은 정지 경로를 쓴다", () => {
    const { controller, nodes } = setup();

    controller.update(INSIDE, "village-a");
    expect(nodes).toHaveLength(1);

    controller.update(OUTSIDE, "village-a");
    expect(nodes[0].stop).toHaveBeenCalledTimes(1);
    expect(nodes[0].disconnect).toHaveBeenCalledTimes(1);

    controller.update(OUTSIDE, "village-a");
    expect(nodes[0].stop).toHaveBeenCalledTimes(1);
    expect(nodes[0].disconnect).toHaveBeenCalledTimes(1);

    controller.update(INSIDE, "village-a");
    expect(nodes).toHaveLength(2);
    expect(nodes[1].start).toHaveBeenCalledTimes(1);

    controller.update(INSIDE, "lobby");
    expect(nodes[1].stop).toHaveBeenCalledTimes(1);
    expect(nodes[1].disconnect).toHaveBeenCalledTimes(1);
    expect(nodes).toHaveLength(2);
  });

  it("suspended 복귀 이벤트에서만 resume하고 rejection을 삼키며, destroy가 노드·gain·리스너를 정리한다", async () => {
    const { controller, context, nodes, gains } = setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    controller.update(INSIDE, "village-a");

    // running 상태에서는 resume하지 않는다
    document.dispatchEvent(new Event("visibilitychange"));
    expect(context.resume).not.toHaveBeenCalled();

    // suspended + 복귀 이벤트 → resume, rejection이어도 throw하지 않는다
    context.state = "suspended";
    context.resume.mockRejectedValueOnce(new Error("blocked"));
    window.dispatchEvent(new Event("focus"));
    expect(context.resume).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalledTimes(1);

    // pointerdown / keydown도 복귀 경로다
    document.dispatchEvent(new Event("pointerdown"));
    document.dispatchEvent(new Event("keydown"));
    expect(context.resume).toHaveBeenCalledTimes(3);

    controller.destroy();
    expect(nodes[0].stop).toHaveBeenCalledTimes(1);
    expect(nodes[0].disconnect).toHaveBeenCalledTimes(1);
    expect(gains[0].disconnect).toHaveBeenCalledTimes(1);

    // destroy 이후에는 이벤트도 update도 아무 동작이 없다
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("pointerdown"));
    expect(context.resume).toHaveBeenCalledTimes(3);
    controller.update(INSIDE, "village-a");
    expect(nodes).toHaveLength(1);
  });
});
