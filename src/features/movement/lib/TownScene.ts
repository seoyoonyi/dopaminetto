import { VILLAGES } from "@/entities/village";
import { useMovementStore } from "@/features/movement";
import { RemotePlayer } from "@/features/movement/model/types";
import * as Phaser from "phaser";

const CAPTURED_KEYS = "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE";

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
  private unsubscribeStore?: () => void;
  private remotePlayerSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private remotePlayerNames: Map<string, Phaser.GameObjects.Text> = new Map();
  private remotePlayerTargets: Map<string, { x: number; y: number }> = new Map();
  private playerNameLabel!: Phaser.GameObjects.Text;
  private localUserId: string = "";
  private debugText!: Phaser.GameObjects.Text;

  constructor() {
    super("TownScene");
  }

  preload = () => {
    // 플레이어를 식별하기 위한 임시 원형 텍스처 생성
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x3498db); // 파란색 (로컬 플레이어)
    graphics.fillCircle(16, 16, 16);
    graphics.generateTexture("player", 32, 32);

    // 타 플레이어 식별용 텍스처
    const remoteGraphics = this.make.graphics({ x: 0, y: 0 });
    remoteGraphics.fillStyle(0x2ecc71); // 초록색 (타 플레이어)
    remoteGraphics.fillCircle(16, 16, 16);
    remoteGraphics.generateTexture("remotePlayer", 32, 32);
  };

  create = () => {
    const store = useMovementStore.getState();
    const initialPos = store.position;
    // MovementStore에서 유저 ID 가져오기 (동기화됨)
    this.localUserId = store.userId;

    this.player = this.add.sprite(initialPos.x, initialPos.y, "player");
    this.player.setDepth(10); // 로컬 플레이어를 최상단에

    this.playerNameLabel = this.add.text(initialPos.x, initialPos.y - 30, store.nickname, {
      fontSize: "14px",
      color: "#ffffff",
      backgroundColor: "#00000088",
      padding: { x: 4, y: 2 },
    });
    this.playerNameLabel.setOrigin(0.5);
    this.playerNameLabel.setDepth(11);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };

    // Phaser가 WASD 및 방향키를 캡처하도록 설정
    // 채팅창 포커스 시 update 루프에서 동적으로 제어
    this.input.keyboard!.addCapture(CAPTURED_KEYS);

    this.boundsGraphics = this.add.graphics();

    // 배경색 설정 (마을 사이 공백용)
    this.cameras.main.setBackgroundColor("#2c3e50");

    // 디버그 텍스트 추가
    this.debugText = this.add
      .text(10, 10, "Debug Info", {
        fontSize: "16px",
        color: "#00ff00",
        backgroundColor: "#000000aa",
      })
      .setScrollFactor(0)
      .setDepth(100);

    // 마을 경계선 및 이름 초기화 (한 번만 생성)
    Object.values(VILLAGES).forEach((village) => {
      this.boundsGraphics.lineStyle(2, Phaser.Display.Color.HexStringToColor(village.color).color);
      this.boundsGraphics.strokeRect(
        village.boundary.x1,
        village.boundary.y1,
        village.boundary.x2 - village.boundary.x1,
        village.boundary.y2 - village.boundary.y1,
      );

      this.add
        .text(village.boundary.x1 + 10, village.boundary.y1 + 10, village.name, {
          fontSize: "12px",
          color: village.color,
        })
        .setDepth(5);
    });

    this.updateRemotePlayers(store.remotePlayers);

    // Zustand 스토어 구독: 필요한 필드만 선택하여 불필요한 리렌더링 방지
    this.unsubscribeStore = useMovementStore.subscribe(
      (state) => ({
        position: state.position,
        nickname: state.nickname,
        remotePlayers: state.remotePlayers,
        userId: state.userId,
      }),
      (next, prev) => {
        if (!this.player || !this.playerNameLabel || !this.player.active) return;

        // 유저 ID가 뒤늦게 설정된 경우를 대비해 업데이트
        if (!this.localUserId && next.userId) {
          this.localUserId = next.userId;
          this.updateRemotePlayers(next.remotePlayers);
        }

        // 로컬 플레이어 위치 업데이트 (변경된 경우만)
        if (next.position !== prev.position) {
          this.player.setPosition(next.position.x, next.position.y);
          this.playerNameLabel.setPosition(next.position.x, next.position.y - 30);
        }

        // 로컬 닉네임 업데이트 (변경된 경우만)
        if (next.nickname !== prev.nickname) {
          this.playerNameLabel.setText(next.nickname || "익명");
        }

        // 타 플레이어 위치 업데이트 (참조가 변경된 경우에만)
        if (next.remotePlayers !== prev.remotePlayers) {
          this.updateRemotePlayers(next.remotePlayers);
        }
      },
      {
        equalityFn: (a, b) =>
          a.position === b.position &&
          a.nickname === b.nickname &&
          a.remotePlayers === b.remotePlayers &&
          a.userId === b.userId,
      },
    );

    // 카메라가 플레이어를 화면 중앙에 오도록 고정
    this.cameras.main.startFollow(this.player, true, 1, 1);

    // Scene 종료 시 구독 해제 설정
    this.events.once("shutdown", () => {
      if (this.unsubscribeStore) this.unsubscribeStore();
      this.remotePlayerSprites.clear();
      this.remotePlayerNames.clear();
      this.remotePlayerTargets.clear();
    });
  };

  /**
   * 타 플레이어들의 위치와 닉네임을 업데이트합니다.
   */
  updateRemotePlayers = (remotePlayers: Record<string, RemotePlayer>) => {
    // 로컬 유저 ID가 아직 설정되지 않은 경우, 본인 식별이 불가능하므로 렌더링 보류
    if (!this.localUserId) return;

    const activeUserIds = new Set(Object.keys(remotePlayers));

    // 1. 사라진 플레이어 또는 본인(중복 방지) 정리
    this.remotePlayerSprites.forEach((sprite, userId) => {
      if (!activeUserIds.has(userId) || userId === this.localUserId) {
        sprite.destroy();
        this.remotePlayerNames.get(userId)?.destroy();
        this.remotePlayerSprites.delete(userId);
        this.remotePlayerNames.delete(userId);
        this.remotePlayerTargets.delete(userId);
      }
    });

    // 2. 신규/기존 플레이어 위치 업데이트
    Object.entries(remotePlayers).forEach(([userId, data]) => {
      // 본인은 원격 플레이어로 그리지 않음
      if (userId === this.localUserId) return;

      let sprite = this.remotePlayerSprites.get(userId);
      let nameLabel = this.remotePlayerNames.get(userId);

      if (!sprite) {
        if (!data.position) {
          console.warn(`[TownScene] Skipped rendering ${userId} due to missing position`, data);
          return;
        }

        // 새 플레이어 생성
        sprite = this.add.sprite(data.position.x, data.position.y, "remotePlayer");
        this.remotePlayerSprites.set(userId, sprite);

        nameLabel = this.add.text(data.position.x, data.position.y - 30, data.nickname, {
          fontSize: "14px",
          color: "#ffffff",
          backgroundColor: "#00000088",
          padding: { x: 4, y: 2 },
        });
        nameLabel.setOrigin(0.5);
        this.remotePlayerNames.set(userId, nameLabel);
      } else {
        // 기존 플레이어 닉네임 업데이트
        if (nameLabel && nameLabel.text !== data.nickname) {
          nameLabel.setText(data.nickname);
        }
      }

      // 목표 위치 업데이트 (LERP용)
      if (data.position) {
        this.remotePlayerTargets.set(userId, { x: data.position.x, y: data.position.y });
      }
    });
  };

  update = () => {
    // 1. 타 플레이어 위치 보간 (LERP)
    this.remotePlayerSprites.forEach((sprite, userId) => {
      const target = this.remotePlayerTargets.get(userId);
      if (target) {
        // 0.2는 보간 속도 (수치가 높을수록 빠름, 100ms 동기화 주기에 적합)
        sprite.x = Phaser.Math.Linear(sprite.x, target.x, 0.2);
        sprite.y = Phaser.Math.Linear(sprite.y, target.y, 0.2);

        const nameLabel = this.remotePlayerNames.get(userId);
        if (nameLabel) {
          nameLabel.setPosition(sprite.x, sprite.y - 30);
        }
      }
    });

    // 2. 로컬 플레이어 입력 처리
    const speed = 4;

    // 입력 필드 포커스 시:
    // 1. removeCapture로 Phaser의 키 캡처를 해제하여 브라우저가 키 이벤트를 처리하도록 함
    // 2. 캐릭터 이동 로직 실행 방지
    const activeElement = document.activeElement;
    const isInputFocused =
      activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA");

    if (this.input.keyboard) {
      if (isInputFocused) {
        // 채팅창 포커스 시: 키 캡처 해제하여 브라우저가 키 입력을 처리하도록 함
        this.input.keyboard.removeCapture(CAPTURED_KEYS);
        return;
      } else {
        // 게임 플레이 시: 키 캡처 활성화하여 Phaser가 키 입력을 독점하도록 함
        this.input.keyboard.addCapture(CAPTURED_KEYS);
      }
    }

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

    // 디버그 정보 업데이트
    const store = useMovementStore.getState();
    if (this.debugText) {
      this.debugText.setText([
        `Village: ${store.villageId}`,
        `Pos: ${Math.round(this.player.x)}, ${Math.round(this.player.y)}`,
        `Remote: ${Object.keys(store.remotePlayers).length}`,
        `ID: ${this.localUserId?.slice(0, 4)}`,
      ]);
    }
  };
}
