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

type TestTiledObject = {
  name?: string;
  type?: string;
};

type TestTiledLayer = {
  name?: string;
  image?: string;
  objects?: TestTiledObject[];
};

type TestTiledMapJson = {
  layers: TestTiledLayer[];
};

const removeLayer = (tmj: TestTiledMapJson, layerName: string) => ({
  ...tmj,
  layers: tmj.layers.filter((layer) => layer.name !== layerName),
});

const removeImage = (tmj: TestTiledMapJson, layerName: string) => ({
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

const updateLayerObjects = (
  tmj: TestTiledMapJson,
  layerName: string,
  updater: (objects: TestTiledObject[]) => TestTiledObject[],
) => ({
  ...tmj,
  layers: tmj.layers.map((layer) =>
    layer.name === layerName
      ? {
          ...layer,
          objects: updater(layer.objects ?? []),
        }
      : layer,
  ),
});

const removeObject = (
  tmj: TestTiledMapJson,
  layerName: string,
  objectName: string,
  objectType: string,
) =>
  updateLayerObjects(tmj, layerName, (objects) =>
    objects.filter((object) => object.name !== objectName || object.type !== objectType),
  );

const renameObject = (
  tmj: TestTiledMapJson,
  layerName: string,
  objectName: string,
  objectType: string,
  nextName: string,
) =>
  updateLayerObjects(tmj, layerName, (objects) =>
    objects.map((object) =>
      object.name === objectName && object.type === objectType
        ? {
            ...object,
            name: nextName,
          }
        : object,
    ),
  );

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
    expect(mapLoader.getSpawnPoint("village-a")).toMatchObject({
      name: "village-a",
      type: "SpawnPoint",
      x: expect.any(Number),
      y: expect.any(Number),
    });
    expect(mapLoader.getSpawnPoint("village-b")).toMatchObject({
      name: "village-b",
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

  it("throws a clear error when a VillageArea is missing for a playable village", () => {
    expect(() => {
      new MapLoader(removeObject(loadTownMapJson(), "Trigger", "village-b", "VillageArea"));
    }).toThrow("[MapLoader] VillageArea VillageId 불일치: 누락=village-b");
  });

  it("throws a clear error when a SpawnPoint is missing for a village", () => {
    expect(() => {
      new MapLoader(removeObject(loadTownMapJson(), "Spawn", "village-a", "SpawnPoint"));
    }).toThrow("[MapLoader] SpawnPoint VillageId 불일치: 누락=village-a");
  });

  it("throws a clear error when map objects reference an unknown VillageId", () => {
    expect(() => {
      new MapLoader(
        renameObject(loadTownMapJson(), "Trigger", "village-a", "VillageArea", "unknown-village"),
      );
    }).toThrow("[MapLoader] VillageArea의 name이 등록되지 않은 VillageId입니다: unknown-village");
  });

  it("parses the campfire Point Object from the Effects layer", () => {
    const mapLoader = loadTownMap();
    const campfireEffects = mapLoader.getCampfireEffects();

    expect(campfireEffects).toHaveLength(1);
    expect(campfireEffects[0]).toMatchObject({
      name: "campfire",
      x: expect.any(Number),
      y: expect.any(Number),
    });
    // TMJ에 custom property가 아직 설정되지 않았으므로 파싱 결과는 undefined여야 한다
    // (기본값 적용은 MapLoader가 아닌 소비하는 쪽의 책임).
    expect(campfireEffects[0].animationKey).toBeUndefined();
    expect(campfireEffects[0].colliderWidth).toBeUndefined();
  });

  it("derives a static collision rect matching the rendered campfire-base footprint", () => {
    const mapLoader = loadTownMap();
    const campfire = mapLoader.getCampfireEffects()[0];
    const derivedRect = mapLoader
      .getCollisionRects()
      .find((rect) => rect.type === "Campfire" && rect.id === campfire.id);

    // 기본 오프셋(18, -10)은 CampfireEffectsController가 그리는 campfire-base.png
    // (194x63, scale 0.4, origin 0.27/0.9)의 실제 표시 영역과 겹치도록 잡은 값이다.
    expect(derivedRect).toBeDefined();
    expect(derivedRect!.x + derivedRect!.width / 2).toBeCloseTo(campfire.x + 18);
    expect(derivedRect!.y + derivedRect!.height / 2).toBeCloseTo(campfire.y - 10);
  });

  it("returns an empty campfire effect list when the Effects layer is missing", () => {
    const mapLoader = new MapLoader(removeLayer(loadTownMapJson(), "Effects"));

    expect(mapLoader.getCampfireEffects()).toEqual([]);
  });
});
