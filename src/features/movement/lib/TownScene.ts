import { TRANSITION_ZONES, VILLAGES } from "@/entities/village";
import { useMovementStore } from "@/features/movement";
import * as Phaser from "phaser";

export class TownScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private boundsGraphics!: Phaser.GameObjects.Graphics;
  private transitionGraphics!: Phaser.GameObjects.Graphics;
  private unsubscribeStore?: () => void;

  constructor() {
    super("TownScene");
  }

  preload = () => {
    // 플레이어를 식별하기 위한 임시 원형 텍스처 생성
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xffffff);
    graphics.fillCircle(16, 16, 16);
    graphics.generateTexture("player", 32, 32);
  };

  create = () => {
    const store = useMovementStore.getState();
    const initialPos = store.position;

    this.player = this.add.sprite(initialPos.x, initialPos.y, "player");
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };

    this.boundsGraphics = this.add.graphics();
    this.transitionGraphics = this.add.graphics();

    this.updateVisuals(store.villageId);

    // Zustand 스토어 구독: React 상태 변화를 Phaser 엔진에 즉시 반영
    this.unsubscribeStore = useMovementStore.subscribe((state, prevState) => {
      this.player.x = state.position.x;
      this.player.y = state.position.y;

      // 마을이 변경된 경우에만 관련 비주얼(경계선, 이동 구역) 재렌더링
      if (state.villageId !== prevState.villageId) {
        this.updateVisuals(state.villageId);
      }
    });

    // Scene 종료 시 구독 해제 설정
    this.events.once("shutdown", () => {
      if (this.unsubscribeStore) this.unsubscribeStore();
    });
  };

  updateVisuals = (storeVillageId: string) => {
    this.boundsGraphics.clear();
    const currentVillage = VILLAGES[storeVillageId as keyof typeof VILLAGES];
    if (!currentVillage) return;

    this.boundsGraphics.lineStyle(
      2,
      Phaser.Display.Color.HexStringToColor(currentVillage.color).color,
    );
    this.boundsGraphics.strokeRect(
      currentVillage.boundary.x1,
      currentVillage.boundary.y1,
      currentVillage.boundary.x2 - currentVillage.boundary.x1,
      currentVillage.boundary.y2 - currentVillage.boundary.y1,
    );

    this.transitionGraphics.clear();
    TRANSITION_ZONES.filter((tz) => tz.fromVillageId === storeVillageId).forEach((tz) => {
      this.transitionGraphics.fillStyle(0xffff00, 0.3);
      this.transitionGraphics.fillRect(
        tz.triggerZone.x1,
        tz.triggerZone.y1,
        tz.triggerZone.x2 - tz.triggerZone.x1,
        tz.triggerZone.y2 - tz.triggerZone.y1,
      );
    });
  };

  update = () => {
    const speed = 4;
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -speed;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) dx = speed;

    if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -speed;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) dy = speed;

    if (dx !== 0 || dy !== 0) {
      // 위치 업데이트 요청 (검증 로직은 스토어 내부에서 실행됨)
      useMovementStore.getState().updatePosition({ x: dx, y: dy });
    }

    // 카메라가 플레이어를 부드럽게 따라가도록 설정 (Phaser 기본 좌표 기준)
    this.cameras.main.scrollX = this.player.x - 400;
    this.cameras.main.scrollY = this.player.y - 300;
  };
}
