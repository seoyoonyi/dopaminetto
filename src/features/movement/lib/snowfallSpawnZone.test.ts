import { describe, expect, it, vi } from "vitest";

import { createSnowPointGenerator } from "./snowfallSpawnZone";

describe("createSnowPointGenerator", () => {
  it("빌리지 구분 없이 Tiled 맵 전체에서 위치를 선택한다", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.5).mockReturnValueOnce(0.5);
    const generatePoint = createSnowPointGenerator({ x: 0, y: 0, width: 100, height: 100 });
    const point = { x: 0, y: 0 };

    generatePoint(point);

    expect(point).toEqual({ x: 50, y: 50 });
  });

  it("Tiled 월드 경계를 기준으로 위치를 계산한다", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0).mockReturnValueOnce(0.999);
    const generatePoint = createSnowPointGenerator({ x: 10, y: 20, width: 100, height: 100 });
    const point = { x: 0, y: 0 };

    generatePoint(point);

    expect(point).toEqual({ x: 10, y: 119.9 });
  });
});
