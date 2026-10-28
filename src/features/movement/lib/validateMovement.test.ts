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

describe("validateMovement Christmas tree collision", () => {
  it("트리 밑동 진입은 막고 뒤쪽과 앞쪽 우회는 허용한다", () => {
    const mapLoader = loadTownMap();
    expect(
      mapLoader
        .getCollisionRects()
        .filter((rect) => rect.type === "ChristmasTree")
        .map(({ x, y, width, height, name }) => ({ x, y, width, height, name })),
    ).toEqual([
      {
        x: 594,
        y: 786,
        width: 292,
        height: 28,
        name: "christmas-tree-base-upper",
      },
      {
        x: 622,
        y: 814,
        width: 236,
        height: 43,
        name: "christmas-tree-base-lower",
      },
      {
        x: 574,
        y: 814,
        width: 48,
        height: 43,
        name: "christmas-tree-base-left-corner",
      },
      {
        x: 560,
        y: 814,
        width: 14,
        height: 43,
        name: "christmas-tree-base-left-outer-corner",
      },
      {
        x: 858,
        y: 814,
        width: 28,
        height: 43,
        name: "christmas-tree-base-right-corner",
      },
    ]);

    const blocked = validateMovement({ x: 740, y: 780 }, "lobby", { x: 0, y: 12 }, mapLoader);
    expect(blocked.nextPosition).toEqual({ x: 740, y: 780 });

    const behind = validateMovement({ x: 740, y: 770 }, "lobby", { x: 0, y: 4 }, mapLoader);
    expect(behind.nextPosition).toEqual({ x: 740, y: 774 });

    const aroundSide = validateMovement({ x: 540, y: 820 }, "lobby", { x: 0, y: -4 }, mapLoader);
    expect(aroundSide.nextPosition).toEqual({ x: 540, y: 816 });

    const blockedAtLeftCorner = validateMovement(
      { x: 580, y: 835 },
      "lobby",
      { x: 20, y: 0 },
      mapLoader,
    );
    expect(blockedAtLeftCorner.nextPosition).toEqual({ x: 580, y: 835 });

    const blockedAtOuterLeftCorner = validateMovement(
      { x: 560, y: 835 },
      "lobby",
      { x: 20, y: 0 },
      mapLoader,
    );
    expect(blockedAtOuterLeftCorner.nextPosition).toEqual({ x: 560, y: 835 });

    const approachLeftCorner = validateMovement(
      { x: 540, y: 835 },
      "lobby",
      { x: 14, y: 0 },
      mapLoader,
    );
    expect(approachLeftCorner.nextPosition).toEqual({ x: 554, y: 835 });

    const blockedAtOuterEdge = validateMovement(
      { x: 554, y: 835 },
      "lobby",
      { x: 4, y: 0 },
      mapLoader,
    );
    expect(blockedAtOuterEdge.nextPosition).toEqual({ x: 554, y: 835 });

    const blockedAtRightCorner = validateMovement(
      { x: 900, y: 835 },
      "lobby",
      { x: -20, y: 0 },
      mapLoader,
    );
    expect(blockedAtRightCorner.nextPosition).toEqual({ x: 900, y: 835 });

    const inFront = validateMovement({ x: 740, y: 874 }, "lobby", { x: 0, y: -4 }, mapLoader);
    expect(inFront.nextPosition).toEqual({ x: 740, y: 870 });
  });
});
