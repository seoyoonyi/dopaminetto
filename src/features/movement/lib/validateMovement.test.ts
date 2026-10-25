import { MapLoader } from "@/entities/village";
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { validateMovement } from "./validateMovement";

const loadTownMap = () => {
  const tmjPath = path.resolve(process.cwd(), "public/assets/images/town-map.tmj");
  const tmj = JSON.parse(readFileSync(tmjPath, "utf8"));

  return new MapLoader(tmj, { tmjUrl: "/assets/images/town-map.tmj" });
};

describe("validateMovement snowman collision", () => {
  it("blocks entry into the footprint and allows moving around it", () => {
    const mapLoader = loadTownMap();
    expect(
      mapLoader
        .getCollisionRects()
        .filter((rect) => rect.type === "Snowman")
        .map(({ x, y, width, height }) => ({ x, y, width, height })),
    ).toEqual([
      { x: 520, y: 320, width: 60, height: 56 },
      { x: 500, y: 352, width: 100, height: 34 },
      { x: 512, y: 376, width: 84, height: 40 },
      { x: 508, y: 408, width: 96, height: 24 },
    ]);

    const blocked = validateMovement({ x: 550, y: 432 }, "lobby", { x: 0, y: -4 }, mapLoader);

    expect(blocked.nextPosition).toEqual({ x: 550, y: 432 });

    const blockedAtHead = validateMovement({ x: 550, y: 320 }, "lobby", { x: 0, y: 4 }, mapLoader);
    expect(blockedAtHead.nextPosition).toEqual({ x: 550, y: 320 });

    const blockedAtRightEdge = validateMovement(
      { x: 590, y: 440 },
      "lobby",
      { x: 0, y: -4 },
      mapLoader,
    );
    expect(blockedAtRightEdge.nextPosition).toEqual({ x: 590, y: 440 });

    const around = validateMovement({ x: 480, y: 450 }, "lobby", { x: 55, y: 0 }, mapLoader);

    expect(around.nextPosition).toEqual({ x: 535, y: 450 });
  });
});
