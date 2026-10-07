import type { MapImageLayer, MapLoader } from "@/entities/village";
import * as Phaser from "phaser";

import { GAME_CONFIG } from "../model/config";

const MAP_BACKGROUND_KEY = "town-map-background";
const MAP_FRONT_KEY = "town-map-front";
const BACKGROUND_DEPTH = 0;
const FRONT_DEPTH = 8000;

/** 타운 맵 이미지와 카메라 설정, 직접 등록한 resize 이벤트를 관리한다. */
export class TownMapCameraController {
  private resizeHandler?: () => void;

  static preload(scene: Phaser.Scene, mapLoader: MapLoader | null): void {
    if (!mapLoader) return;

    const backgroundImage = mapLoader.getBackgroundImage();
    const frontImage = mapLoader.getFrontImage();

    if (backgroundImage.visible) {
      scene.load.image(MAP_BACKGROUND_KEY, backgroundImage.url);
    }

    if (frontImage.visible) {
      scene.load.image(MAP_FRONT_KEY, frontImage.url);
    }
  }

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly mapLoader: MapLoader | null,
  ) {
    if (!mapLoader) return;

    const backgroundImage = mapLoader.getBackgroundImage();
    if (backgroundImage.visible) {
      this.renderImageLayer(backgroundImage, MAP_BACKGROUND_KEY, BACKGROUND_DEPTH);
    }

    const bounds = mapLoader.getMapBounds();
    this.applyCameraBounds(bounds);
    this.scene.cameras.main.setZoom(GAME_CONFIG.CAMERA_ZOOM);

    this.resizeHandler = () => this.applyCameraBounds(bounds);
    this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.resizeHandler);
  }

  /** 기존 create 순서에 맞춰 전경 레이어를 로컬 캐릭터 뒤에 추가한다. */
  renderFrontLayer(): void {
    const frontImage = this.mapLoader?.getFrontImage();
    if (frontImage?.visible) {
      this.renderImageLayer(frontImage, MAP_FRONT_KEY, FRONT_DEPTH);
    }
  }

  /** 생성된 로컬 캐릭터를 카메라가 추적하도록 연결한다. */
  follow(target: Phaser.GameObjects.GameObject): void {
    this.scene.cameras.main.startFollow(target, true, 1, 1);
  }

  /** 이 컨트롤러가 등록한 resize 핸들러만 해제한다. */
  destroy(): void {
    if (!this.resizeHandler) return;

    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.resizeHandler);
    this.resizeHandler = undefined;
  }

  private renderImageLayer(imageLayer: MapImageLayer, assetKey: string, depth: number): void {
    this.scene.add
      .image(imageLayer.x, imageLayer.y, assetKey)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setVisible(imageLayer.visible);
  }

  private applyCameraBounds(mapBounds: { x: number; y: number; width: number; height: number }) {
    const camera = this.scene.cameras.main;
    const offsetX = Math.max(0, Math.floor((camera.width - mapBounds.width) / 2));
    const offsetY = Math.max(0, Math.floor((camera.height - mapBounds.height) / 2));

    camera.setBounds(
      mapBounds.x - offsetX,
      mapBounds.y - offsetY,
      Math.max(mapBounds.width, camera.width),
      Math.max(mapBounds.height, camera.height),
    );
  }
}
