import Phaser from "phaser";

export class TileMapScene extends Phaser.Scene {
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private player?: Phaser.Physics.Arcade.Sprite;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private collisionLayer?: Phaser.Tilemaps.TilemapLayer | null;

  constructor() {
    super({ key: "TileMapScene" });
  }

  preload() {
    this.load.tilemapTiledJSON("tileMap", "/map-3.tmj");
    this.load.image("town-tileset", "/town-tileset.png");
  }

  create() {
    const map = this.make.tilemap({ key: "tileMap" });
    const tileset = map.addTilesetImage("town-tileset", "town-tileset");

    if (!tileset) {
      console.error("타일셋 로드 실패!");
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const groundLayer = map.createLayer("floor", tileset, 0, 0);

    groundLayer?.forEachTile((tile) => {
      if (tile.index !== -1) {
        const tileWorldX = tile.pixelX;
        const tileWorldY = tile.pixelY;

        minX = Math.min(minX, tileWorldX);
        minY = Math.min(minY, tileWorldY);
        maxX = Math.max(maxX, tileWorldX + tile.width);
        maxY = Math.max(maxY, tileWorldY + tile.height);
      }
    });

    this.collisionLayer = map.createLayer("collision", tileset, 0, 0);

    if (this.collisionLayer) {
      this.collisionLayer.setCollisionByExclusion([-1]);
      this.collisionLayer.setVisible(true);
    }

    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;

    this.physics.world.setBounds(minX, minY, worldWidth, worldHeight);

    const graphics = this.add.graphics();
    graphics.fillStyle(0x00ff00, 1);
    graphics.fillRect(0, 0, 32, 32);
    graphics.generateTexture("player", 32, 32);
    graphics.destroy();

    this.player = this.physics.add.sprite(320, 320, "player");
    this.player.setCollideWorldBounds(true);

    if (this.collisionLayer) {
      this.physics.add.collider(this.player, this.collisionLayer);
    }

    this.cursors = this.input.keyboard?.createCursorKeys();

    this.cameras.main.setBounds(minX, minY, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player);
    this.cameras.main.setZoom(1);

    this.setupControls();
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
