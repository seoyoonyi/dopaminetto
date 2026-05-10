import { VILLAGES } from "@/entities/village";
import { useMovementStore } from "@/features/movement";
import { RemotePlayer } from "@/features/movement/model/types";
import * as Phaser from "phaser";

const CAPTURED_KEYS = "W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE";

/**
 * 캐릭터 스프라이트 에셋 정보 및 렌더링 규격 설정 상수
 * 이미지 교체 시 이 부분의 수치만 수정하여 전체 시스템에 적용 가능
 */
export const CHARACTER_CONFIG = {
  assetKey: "p-boy-sprite",
  assetUrl: "/assets/images/p-boy-sprite-s.png",
  imageWidth: 147, // 원본 이미지 전체 가로 크기
  imageHeight: 348, // 원본 이미지 전체 세로 크기
  scale: 1, // 화면 표시 배율
  originY: 1, // 캐릭터 발밑을 기준점으로 설정하여 지면 접지력을 높이고 이름표 위치 고정

  /**
   * 스프라이트 시트 가로 프레임 개수(3열) 기준 한 칸 너비 계산
   */
  get frameWidth() {
    return this.imageWidth / 3;
  },
  /**
   * 스프라이트 시트 세로 프레임 개수(4행) 기준 한 칸 높이 계산
   */
  get frameHeight() {
    return this.imageHeight / 4;
  },
  /**
   * 캐릭터 발밑(Origin 1.0) 기준 이름표 표시 높이 계산
   * 프레임 전체 높이보다 약간 위(5px)에 위치하도록 설정
   */
  get labelOffsetY() {
    return this.frameHeight + 5;
  },
};

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
    // 플레이어 캐릭터 스프라이트 시트 로드
    this.load.spritesheet(CHARACTER_CONFIG.assetKey, CHARACTER_CONFIG.assetUrl, {
      frameWidth: CHARACTER_CONFIG.frameWidth,
      frameHeight: CHARACTER_CONFIG.frameHeight,
    });
  };

  create = () => {
    const store = useMovementStore.getState();
    const initialPos = store.position;
    // MovementStore에서 유저 ID 가져오기 (동기화됨)
    this.localUserId = store.userId;

    // 방향별 걷기 애니메이션 등록 (가로 3열, 세로 4행 기준)
    // 프레임 순서: 왼발 → 양발 → 오른발 → 양발 (걷는 발부터 시작하여 짧은 입력에도 발 움직임이 보임)
    const animConfig = [
      { key: "walk-down", frames: [1, 0, 2, 0] }, // 1행 (아래)
      { key: "walk-left", frames: [4, 3, 5, 3] }, // 2행 (왼쪽)
      { key: "walk-right", frames: [7, 6, 8, 6] }, // 3행 (오른쪽)
      { key: "walk-up", frames: [10, 9, 11, 9] }, // 4행 (위)
    ];

    animConfig.forEach((anim) => {
      this.anims.create({
        key: anim.key,
        frames: this.anims.generateFrameNumbers(CHARACTER_CONFIG.assetKey, { frames: anim.frames }),
        frameRate: 6,
        repeat: -1,
      });
    });

    this.player = this.add.sprite(initialPos.x, initialPos.y, CHARACTER_CONFIG.assetKey, 0); // 기본 정지 프레임(정면, 양발)
    this.player.setScale(CHARACTER_CONFIG.scale);
    this.player.setOrigin(0.5, CHARACTER_CONFIG.originY); // 기준점을 하단 중앙으로 설정
    this.player.setDepth(10); // 로컬 플레이어를 최상단에

    this.playerNameLabel = this.add.text(
      initialPos.x,
      initialPos.y - CHARACTER_CONFIG.labelOffsetY,
      store.nickname,
      {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 4, y: 2 },
      },
    );
    this.playerNameLabel.setOrigin(0.5, 1); // 이름표의 바닥을 기준점으로 설정
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
          // 이름표 위치는 update() 루프에서 매 프레임 갱신하므로 여기서 중복 처리하지 않음
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
   * 타 플레이어 위치, 닉네임 정보를 화면에 반영
   * 신규 플레이어 생성, 퇴장 플레이어 제거, 기존 플레이어 목표 위치 갱신 수행
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
        sprite = this.add.sprite(data.position.x, data.position.y, CHARACTER_CONFIG.assetKey, 1);
        sprite.setScale(CHARACTER_CONFIG.scale);
        sprite.setOrigin(0.5, CHARACTER_CONFIG.originY); // 리모트 플레이어도 발밑 기준
        this.remotePlayerSprites.set(userId, sprite);

        nameLabel = this.add.text(
          data.position.x,
          data.position.y - CHARACTER_CONFIG.labelOffsetY,
          data.nickname,
          {
            fontSize: "14px",
            color: "#ffffff",
            backgroundColor: "#00000088",
            padding: { x: 4, y: 2 },
          },
        );
        nameLabel.setOrigin(0.5, 1); // 이름표의 바닥을 기준점으로 설정
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

  /**
   * 매 프레임 호출되는 게임 루프
   * 타 플레이어 위치 보간(LERP), 애니메이션 처리 및 로컬 플레이어 입력 처리
   */
  update = () => {
    /**
     * 1. 타 플레이어 위치 보간 및 애니메이션 처리
     * 네트워크 지연 고려하여 목표 위치까지 부드럽게 이동(LERP) 및 방향에 맞는 애니메이션 재생
     */
    this.remotePlayerSprites.forEach((sprite, userId) => {
      const target = this.remotePlayerTargets.get(userId);
      if (target) {
        // 이동 거리 계산을 위해 이전 위치 저장
        const prevX = sprite.x;
        const prevY = sprite.y;

        // 0.2는 보간 속도 (수치가 높을수록 빠름, 100ms 동기화 주기에 적합)
        sprite.x = Phaser.Math.Linear(sprite.x, target.x, 0.2);
        sprite.y = Phaser.Math.Linear(sprite.y, target.y, 0.2);

        // 리모트 플레이어 애니메이션 처리
        const diffX = sprite.x - prevX;
        const diffY = sprite.y - prevY;

        // 약간의 움직임은 무시 (보간으로 인한 미세 진동)
        if (Math.abs(diffX) > 0.5 || Math.abs(diffY) > 0.5) {
          if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX < 0) {
              sprite.setFlipX(false);
              sprite.anims.play("walk-left", true);
            } else {
              sprite.setFlipX(false);
              sprite.anims.play("walk-right", true);
            }
          } else {
            if (diffY < 0) {
              sprite.anims.play("walk-up", true);
            } else {
              sprite.anims.play("walk-down", true);
            }
          }
        } else {
          sprite.anims.stop();
          const currentAnim = sprite.anims.currentAnim?.key;
          if (currentAnim === "walk-left") sprite.setFrame(3);
          else if (currentAnim === "walk-right") sprite.setFrame(6);
          else if (currentAnim === "walk-up") sprite.setFrame(9);
          else sprite.setFrame(0);
        }

        const nameLabel = this.remotePlayerNames.get(userId);
        if (nameLabel) {
          nameLabel.setPosition(sprite.x, sprite.y - CHARACTER_CONFIG.labelOffsetY);
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

    // 로컬 플레이어 애니메이션 처리
    if (dx !== 0 || dy !== 0) {
      // 좌우 이동과 상하 이동 중 어느 쪽이 우선인지 판단 (여기선 dx와 dy의 절대값이 같으면 좌우 우선)
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (dx < 0) {
          this.player.setFlipX(false);
          this.player.anims.play("walk-left", true);
        } else {
          this.player.setFlipX(false);
          this.player.anims.play("walk-right", true);
        }
      } else {
        if (dy < 0) {
          this.player.anims.play("walk-up", true);
        } else {
          this.player.anims.play("walk-down", true);
        }
      }
    } else {
      this.player.anims.stop();
      const currentAnim = this.player.anims.currentAnim?.key;
      if (currentAnim === "walk-left") this.player.setFrame(3);
      else if (currentAnim === "walk-right") this.player.setFrame(6);
      else if (currentAnim === "walk-up") this.player.setFrame(9);
      else this.player.setFrame(0);
    }

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

    /**
     * 3. 로컬 플레이어 이름표 실시간 동기화
     * 캐릭터 애니메이션 프레임 변화나 이동에 상관없이 이름표가 항상 머리 위 정해진 위치에 오도록 강제
     * 이름표 기준점(setOrigin)이 하단 중앙(0.5, 1)이므로 겹침 없이 렌더링
     */
    if (this.playerNameLabel && this.player) {
      this.playerNameLabel.setPosition(
        this.player.x,
        this.player.y - CHARACTER_CONFIG.labelOffsetY,
      );
    }
  };
}
