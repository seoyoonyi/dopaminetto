import { PLAYABLE_VILLAGE_IDS, VILLAGE_IDS, isVillageId } from "../config/villageData";
import {
  CollisionRect,
  LOBBY_VILLAGE_ID,
  MapBounds,
  MapImageLayer,
  SpawnPoint,
  VillageArea,
  VillageId,
} from "../model/types";

type TiledLayerType = "imagelayer" | "objectgroup" | string;

interface TiledMapJson {
  width?: number;
  height?: number;
  tilewidth?: number;
  tileheight?: number;
  layers?: TiledLayer[];
}

interface TiledLayer {
  name?: string;
  type?: TiledLayerType;
  image?: string;
  offsetx?: number;
  offsety?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  visible?: boolean;
  objects?: TiledObject[];
}

interface TiledObject {
  id?: number;
  name?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  point?: boolean;
  visible?: boolean;
}

interface MapLoaderOptions {
  tmjUrl?: string;
  assetBaseUrl?: string;
}

const IMAGE_LAYER_NAMES = {
  BACKGROUND: "Background",
  FRONT: "Front",
} as const;

const OBJECT_LAYER_NAMES = {
  COLLISION: "Collision",
  TRIGGER: "Trigger",
  SPAWN: "Spawn",
} as const;

const VILLAGE_AREA_TYPE = "VillageArea";
const SPAWN_POINT_TYPE = "SpawnPoint";

export class MapLoader {
  private readonly tmj: TiledMapJson;
  private readonly options: MapLoaderOptions;
  private readonly collisionRects: CollisionRect[];
  private readonly villageAreas: VillageArea[];
  private readonly spawnPoints: Map<VillageId, SpawnPoint>;
  private readonly backgroundImage: MapImageLayer;
  private readonly frontImage: MapImageLayer;
  private mapBounds: MapBounds;

  constructor(tmj: TiledMapJson, options: MapLoaderOptions = {}) {
    this.tmj = tmj;
    this.options = options;
    this.backgroundImage = this.parseRequiredImageLayer(IMAGE_LAYER_NAMES.BACKGROUND);
    this.frontImage = this.parseRequiredImageLayer(IMAGE_LAYER_NAMES.FRONT);
    this.collisionRects = this.parseCollisionRects();
    this.villageAreas = this.parseVillageAreas();
    this.spawnPoints = this.parseSpawnPoints();
    this.validateVillageReferences();
    this.mapBounds = this.createMapBounds();
  }

  static async load(tmjUrl: string, options: Omit<MapLoaderOptions, "tmjUrl"> = {}) {
    const response = await fetch(tmjUrl);

    if (!response.ok) {
      throw new Error(`Failed to load TMJ map: ${tmjUrl} (${response.status})`);
    }

    const tmj = (await response.json()) as TiledMapJson;
    const loader = new MapLoader(tmj, { ...options, tmjUrl });
    await loader.loadImageLayerDimensions();
    return loader;
  }

  getCollisionRects(): CollisionRect[] {
    return this.collisionRects.map((rect) => ({ ...rect }));
  }

  getVillageAreas(): VillageArea[] {
    return this.villageAreas.map((area) => ({ ...area }));
  }

  getSpawnPoint(name: string): SpawnPoint | undefined {
    if (!isVillageId(name)) return undefined;

    const spawnPoint = this.spawnPoints.get(name);
    return spawnPoint ? { ...spawnPoint } : undefined;
  }

  getBackgroundImage(): MapImageLayer {
    return { ...this.backgroundImage };
  }

  getFrontImage(): MapImageLayer {
    return { ...this.frontImage };
  }

  getMapBounds(): MapBounds {
    return { ...this.mapBounds };
  }

  getVillageAt(position: { x: number; y: number }): VillageId {
    const villageArea = this.villageAreas.find((area) => this.containsPoint(area, position));
    return villageArea?.name ?? LOBBY_VILLAGE_ID;
  }

  private parseRequiredImageLayer(name: MapImageLayer["name"]): MapImageLayer {
    const layer = this.requireLayer(name, "imagelayer");

    if (!layer.image) {
      throw new Error(`[MapLoader] 이미지 레이어에 image 값이 없습니다: ${name}`);
    }

    return {
      name,
      image: layer.image,
      url: this.resolveAssetUrl(layer.image),
      x: (layer.x ?? 0) + (layer.offsetx ?? 0),
      y: (layer.y ?? 0) + (layer.offsety ?? 0),
      width: layer.width,
      height: layer.height,
      visible: layer.visible ?? true,
    };
  }

  private parseCollisionRects(): CollisionRect[] {
    const layer = this.requireLayer(OBJECT_LAYER_NAMES.COLLISION, "objectgroup");

    return this.getLayerObjects(layer).map((object) => ({
      id: object.id ?? 0,
      name: object.name ?? "",
      type: object.type ?? "",
      x: object.x ?? 0,
      y: object.y ?? 0,
      width: object.width ?? 0,
      height: object.height ?? 0,
    }));
  }

  private parseVillageAreas(): VillageArea[] {
    const layer = this.requireLayer(OBJECT_LAYER_NAMES.TRIGGER, "objectgroup");

    return this.getLayerObjects(layer)
      .filter((object) => object.type === VILLAGE_AREA_TYPE)
      .map((object) => {
        const name = this.parseVillageObjectName(object, VILLAGE_AREA_TYPE);

        return {
          id: object.id ?? 0,
          name,
          type: VILLAGE_AREA_TYPE,
          x: object.x ?? 0,
          y: object.y ?? 0,
          width: object.width ?? 0,
          height: object.height ?? 0,
        };
      });
  }

  private parseSpawnPoints(): Map<VillageId, SpawnPoint> {
    const layer = this.requireLayer(OBJECT_LAYER_NAMES.SPAWN, "objectgroup");
    const spawnPoints = new Map<VillageId, SpawnPoint>();

    this.getLayerObjects(layer)
      .filter((object) => object.type === SPAWN_POINT_TYPE)
      .forEach((object) => {
        const name = this.parseVillageObjectName(object, SPAWN_POINT_TYPE);

        if (spawnPoints.has(name)) {
          throw new Error(`[MapLoader] SpawnPoint VillageId가 중복되었습니다: ${name}`);
        }

        spawnPoints.set(name, {
          id: object.id ?? 0,
          name,
          type: SPAWN_POINT_TYPE,
          x: object.x ?? 0,
          y: object.y ?? 0,
        });
      });

    return spawnPoints;
  }

  private validateVillageReferences() {
    this.assertUniqueVillageIds(
      VILLAGE_AREA_TYPE,
      this.villageAreas.map((area) => area.name),
    );
    this.assertVillageIdsMatch({
      objectType: VILLAGE_AREA_TYPE,
      actualIds: this.villageAreas.map((area) => area.name),
      expectedIds: PLAYABLE_VILLAGE_IDS,
      description: "Trigger 레이어의 VillageArea는 lobby를 제외한 VILLAGE_IDS와 일치해야 합니다.",
    });
    this.assertVillageIdsMatch({
      objectType: SPAWN_POINT_TYPE,
      actualIds: Array.from(this.spawnPoints.keys()),
      expectedIds: VILLAGE_IDS,
      description: "Spawn 레이어의 SpawnPoint는 VILLAGE_IDS와 일치해야 합니다.",
    });
  }

  private parseVillageObjectName(
    object: TiledObject,
    objectType: typeof VILLAGE_AREA_TYPE | typeof SPAWN_POINT_TYPE,
  ): VillageId {
    const objectId = object.id ?? "unknown";

    if (!object.name) {
      throw new Error(
        `[MapLoader] ${objectType}에 VillageId name이 없습니다: objectId=${objectId}`,
      );
    }

    if (!isVillageId(object.name)) {
      throw new Error(
        `[MapLoader] ${objectType}의 name이 등록되지 않은 VillageId입니다: ${object.name}`,
      );
    }

    return object.name;
  }

  private assertUniqueVillageIds(objectType: string, villageIds: VillageId[]) {
    const seenIds = new Set<VillageId>();
    const duplicateIds = villageIds.filter((villageId) => {
      if (seenIds.has(villageId)) return true;

      seenIds.add(villageId);
      return false;
    });

    if (duplicateIds.length > 0) {
      throw new Error(
        `[MapLoader] ${objectType} VillageId가 중복되었습니다: ${this.formatVillageIds(duplicateIds)}`,
      );
    }
  }

  private assertVillageIdsMatch({
    objectType,
    actualIds,
    expectedIds,
    description,
  }: {
    objectType: string;
    actualIds: VillageId[];
    expectedIds: readonly VillageId[];
    description: string;
  }) {
    const actualIdSet = new Set(actualIds);
    const expectedIdSet = new Set(expectedIds);
    const missingIds = expectedIds.filter((villageId) => !actualIdSet.has(villageId));
    const unexpectedIds = actualIds.filter((villageId) => !expectedIdSet.has(villageId));

    if (missingIds.length === 0 && unexpectedIds.length === 0) return;

    throw new Error(
      `[MapLoader] ${objectType} VillageId 불일치: 누락=${this.formatVillageIds(missingIds)}, 예상외=${this.formatVillageIds(unexpectedIds)}. ${description}`,
    );
  }

  private formatVillageIds(villageIds: readonly VillageId[]) {
    return villageIds.length > 0 ? Array.from(new Set(villageIds)).join(", ") : "없음";
  }

  private findLayer(name: string, type: TiledLayerType): TiledLayer | undefined {
    return this.tmj.layers?.find((layer) => layer.name === name && layer.type === type);
  }

  private requireLayer(name: string, type: TiledLayerType): TiledLayer {
    const layer = this.findLayer(name, type);

    if (!layer) {
      throw new Error(`[MapLoader] 필수 TMJ 레이어가 없습니다: ${name}`);
    }

    return layer;
  }

  private getLayerObjects(layer: TiledLayer): TiledObject[] {
    const offsetX = layer.offsetx ?? 0;
    const offsetY = layer.offsety ?? 0;

    return (layer.objects ?? []).map((object) => ({
      ...object,
      x: (object.x ?? 0) + offsetX,
      y: (object.y ?? 0) + offsetY,
    }));
  }

  private containsPoint(rect: MapBounds, position: { x: number; y: number }) {
    return (
      position.x >= rect.x &&
      position.x <= rect.x + rect.width &&
      position.y >= rect.y &&
      position.y <= rect.y + rect.height
    );
  }

  private resolveAssetUrl(imagePath: string) {
    if (this.isAbsoluteOrRootPath(imagePath)) return imagePath;

    if (this.options.assetBaseUrl) {
      return `${this.ensureTrailingSlash(this.options.assetBaseUrl)}${imagePath}`;
    }

    if (!this.options.tmjUrl) return imagePath;

    if (/^https?:\/\//.test(this.options.tmjUrl)) {
      return new URL(imagePath, this.options.tmjUrl).toString();
    }

    return `${this.getBasePath(this.options.tmjUrl)}${imagePath}`;
  }

  private async loadImageLayerDimensions() {
    if (typeof Image === "undefined") return;

    const layers = [this.backgroundImage, this.frontImage];

    await Promise.all(
      layers.map(async (layer) => {
        if (typeof layer.width === "number" && typeof layer.height === "number") return;

        const dimensions = await this.loadImageDimensions(layer.url);
        layer.width = dimensions.width;
        layer.height = dimensions.height;
      }),
    );

    this.mapBounds = this.createMapBounds();
  }

  private loadImageDimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error(`Failed to load map image: ${url}`));
      image.src = url;
    });
  }

  private createMapBounds(): MapBounds {
    const backgroundWidth = this.backgroundImage?.width;
    const backgroundHeight = this.backgroundImage?.height;
    const tileWidth = (this.tmj.width ?? 0) * (this.tmj.tilewidth ?? 0);
    const tileHeight = (this.tmj.height ?? 0) * (this.tmj.tileheight ?? 0);
    const objectBounds = this.getObjectBounds();

    const x = this.backgroundImage?.x ?? 0;
    const y = this.backgroundImage?.y ?? 0;

    return {
      x,
      y,
      width: Math.max(backgroundWidth ?? 0, tileWidth, objectBounds.maxX - x),
      height: Math.max(backgroundHeight ?? 0, tileHeight, objectBounds.maxY - y),
    };
  }

  private getObjectBounds() {
    const objects = [
      ...this.collisionRects,
      ...this.villageAreas,
      ...Array.from(this.spawnPoints.values()).map((point) => ({
        ...point,
        width: 0,
        height: 0,
      })),
    ];

    return objects.reduce(
      (bounds, object) => ({
        maxX: Math.max(bounds.maxX, object.x + object.width),
        maxY: Math.max(bounds.maxY, object.y + object.height),
      }),
      { maxX: 0, maxY: 0 },
    );
  }

  private isAbsoluteOrRootPath(path: string) {
    return path.startsWith("/") || /^https?:\/\//.test(path) || path.startsWith("data:");
  }

  private ensureTrailingSlash(path: string) {
    return path.endsWith("/") ? path : `${path}/`;
  }

  private getBasePath(path: string) {
    const index = path.lastIndexOf("/");
    return index >= 0 ? path.slice(0, index + 1) : "";
  }
}
