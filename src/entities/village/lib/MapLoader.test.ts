import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { MapLoader } from "./MapLoader";

const loadTownMapJson = () => {
  const tmjPath = path.resolve(process.cwd(), "public/assets/images/town-map.tmj");
  return JSON.parse(readFileSync(tmjPath, "utf8"));
};

const loadTownMap = () => {
  return new MapLoader(loadTownMapJson(), { tmjUrl: "/assets/images/town-map.tmj" });
};

const removeLayer = (tmj: { layers: Array<{ name?: string }> }, layerName: string) => ({
  ...tmj,
  layers: tmj.layers.filter((layer) => layer.name !== layerName),
});

const removeImage = (
  tmj: { layers: Array<{ name?: string; image?: string }> },
  layerName: string,
) => ({
  ...tmj,
  layers: tmj.layers.map((layer) =>
    layer.name === layerName
      ? {
          ...layer,
          image: undefined,
        }
      : layer,
  ),
});

describe("MapLoader", () => {
  it("parses image layers from TMJ", () => {
    const mapLoader = loadTownMap();

    expect(mapLoader.getBackgroundImage()).toMatchObject({
      name: "Background",
      image: "town-map.png",
      url: "/assets/images/town-map.png",
      visible: true,
    });
    expect(mapLoader.getFrontImage()).toMatchObject({
      name: "Front",
      image: "town-map-front.png",
      url: "/assets/images/town-map-front.png",
      visible: true,
    });
  });

  it("parses collision rectangles", () => {
    const mapLoader = loadTownMap();

    expect(mapLoader.getCollisionRects().length).toBeGreaterThan(0);
    expect(mapLoader.getCollisionRects()[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        x: expect.any(Number),
        y: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
      }),
    );
  });

  it("parses village areas and resolves village by position", () => {
    const mapLoader = loadTownMap();
    const villageAreas = mapLoader.getVillageAreas();

    expect(villageAreas.map((area) => area.name).sort()).toEqual(["village-a", "village-b"]);

    const villageA = villageAreas.find((area) => area.name === "village-a");
    expect(villageA).toBeDefined();
    expect(
      mapLoader.getVillageAt({
        x: villageA!.x + villageA!.width / 2,
        y: villageA!.y + villageA!.height / 2,
      }),
    ).toBe("village-a");
  });

  it("parses spawn points by name", () => {
    const mapLoader = loadTownMap();

    expect(mapLoader.getSpawnPoint("lobby")).toMatchObject({
      name: "lobby",
      type: "SpawnPoint",
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(mapLoader.getSpawnPoint("missing")).toBeUndefined();
  });

  it("derives map bounds from TMJ data", () => {
    const mapLoader = loadTownMap();

    expect(mapLoader.getMapBounds()).toEqual(
      expect.objectContaining({
        x: 0,
        y: 0,
        width: expect.any(Number),
        height: expect.any(Number),
      }),
    );
    expect(mapLoader.getMapBounds().width).toBeGreaterThan(0);
    expect(mapLoader.getMapBounds().height).toBeGreaterThan(0);
  });

  it.each(["Background", "Front", "Collision", "Trigger", "Spawn"])(
    "throws a clear error when required %s layer is missing",
    (layerName) => {
      expect(() => {
        new MapLoader(removeLayer(loadTownMapJson(), layerName));
      }).toThrow(`[MapLoader] 필수 TMJ 레이어가 없습니다: ${layerName}`);
    },
  );

  it.each(["Background", "Front"])(
    "throws a clear error when %s image layer has no image value",
    (layerName) => {
      expect(() => {
        new MapLoader(removeImage(loadTownMapJson(), layerName));
      }).toThrow(`[MapLoader] 이미지 레이어에 image 값이 없습니다: ${layerName}`);
    },
  );
});
