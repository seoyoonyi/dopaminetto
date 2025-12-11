import Phaser from "phaser";

export class IllustrationMapScene extends Phaser.Scene {
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private player?: Phaser.Physics.Arcade.Sprite;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super({ key: "IllustrationMapScene" });
  }

  preload() {
    this.load.tilemapTiledJSON("illustrationMap", "/map-2.tmj");
    this.load.image("floor", "/map-illustration.png");
  }

  create() {
    const map = this.make.tilemap({ key: "illustrationMap" });

    this.add.image(0, 0, "floor").setOrigin(0, 0);

    const objectLayer = map.getObjectLayer("collision");

    const graphics = this.add.graphics();
    graphics.fillStyle(0x00ff00, 1);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture("player", 32, 32);
    graphics.destroy();

    this.player = this.physics.add.sprite(320, 320, "player");

    if (objectLayer) {
      objectLayer.objects.forEach((obj) => {
        if (obj.rectangle || (!obj.polyline && !obj.polygon)) {
          const rect = this.add.rectangle(
            obj.x! + obj.width! / 2,
            obj.y! + obj.height! / 2,
            obj.width,
            obj.height,
          );
          this.physics.add.existing(rect, true);
          this.physics.add.collider(this.player!, rect);
          rect.setVisible(false);
        }
      });
    }

    this.cursors = this.input.keyboard?.createCursorKeys();

    const bgImage = this.textures.get("floor").getSourceImage() as HTMLImageElement;
    this.cameras.main.setBounds(0, 0, bgImage.width, bgImage.height);
    this.cameras.main.startFollow(this.player);

    this.physics.world.setBounds(0, 0, bgImage.width, bgImage.height);
    this.player.setCollideWorldBounds(true);

    this.updateCameraZoom(bgImage.width, bgImage.height);

    this.scale.on("resize", () => {
      this.updateCameraZoom(bgImage.width, bgImage.height);
    });

    this.setupControls();
  }

  private updateCameraZoom(mapWidth: number, mapHeight: number) {
    const gameWidth = this.scale.width;
    const gameHeight = this.scale.height;

    const zoomX = gameWidth / mapWidth;
    const zoomY = gameHeight / mapHeight;
    const zoom = Math.min(zoomX, zoomY, 1);

    this.cameras.main.setZoom(zoom);
  }

  private setupControls() {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const deltaX = pointer.x - this.dragStartX;
        const deltaY = pointer.y - this.dragStartY;

        this.cameras.main.scrollX -= deltaX;
        this.cameras.main.scrollY -= deltaY;

        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
      }
    });

    this.input.on("pointerup", () => {
      this.isDragging = false;
    });

    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        const currentZoom = this.cameras.main.zoom;
        const zoomChange = deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Phaser.Math.Clamp(currentZoom + zoomChange, 0.5, 3);

        this.cameras.main.setZoom(newZoom);
      },
    );
  }

  update() {
    if (!this.player || !this.cursors) return;

    const speed = 160;

    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-speed);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(speed);
    } else {
      this.player.setVelocityX(0);
    }

    if (this.cursors.up.isDown) {
      this.player.setVelocityY(-speed);
    } else if (this.cursors.down.isDown) {
      this.player.setVelocityY(speed);
    } else {
      this.player.setVelocityY(0);
    }
  }
}
