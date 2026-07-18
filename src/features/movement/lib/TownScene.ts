/**
 * 마을 시나리오를 관리하는 메인 Phaser Scene 클래스
 * 캐릭터 스프라이트 렌더링, 이동 애니메이션, 이름표 시스템 및 타 플레이어 동기화 로직을 포함
 * 모든 캐릭터 오브젝트는 발밑(Origin 1.0)을 기준으로 정렬됨
 */
import type { MapImageLayer } from "@/entities/village";
import {
  AMBIENT_AUDIO_KEYS,
  AMBIENT_AUDIO_URLS,
  AmbientSoundController,
  CAMPFIRE_SOUND_CONFIG,
  resolveCampfireSources,
} from "@/features/ambientSound";
import {
  CHARACTER_OPTIONS,
  CharacterConfig,
  CharacterId,
  GAME_CONFIG,
  LOCAL_ACTION_ANIMATIONS,
  LOCAL_ACTION_KEY_BINDINGS,
  LocalActionId,
  LocalActionInputId,
  getActionFrameNumbers,
  getCharacterActionConfig,
  getCharacterConfig,
  getLocalActionAnimationKey,
  resolveLocalActionInput,
  resolveRemoteActionState,
  useMovementStore,
} from "@/features/movement";
import {
  CAMPFIRE_BASE_ASSET_KEY,
  CAMPFIRE_BASE_ASSET_URL,
  CAMPFIRE_FLAME_ASSET_KEY,
  CAMPFIRE_FLAME_ASSET_URL,
  CAMPFIRE_FLAME_FRAME_HEIGHT,
  CAMPFIRE_FLAME_FRAME_WIDTH,
  CampfireEffectsController,
} from "@/features/movement/lib/CampfireEffectsController";
import { isEditableElementFocused } from "@/features/movement/lib/domFocus";
import { resolveCampfireVisuals } from "@/features/movement/lib/resolveCampfireVisuals";
import { RemotePlayer } from "@/features/movement/model/types";
import { CHARACTER_ACTION_CONFIGS } from "@/shared/constants";
import * as Phaser from "phaser";

const CAPTURED_KEYS = "W,A,S,D,H,X,ZERO,UP,DOWN,LEFT,RIGHT,SPACE";
const MAP_BACKGROUND_KEY = "town-map-background";
const MAP_FRONT_KEY = "town-map-front";
const BACKGROUND_DEPTH = 0;
const CHARACTER_DEPTH_BASE = 1000;
const FRONT_DEPTH = 8000;
const NAME_LABEL_DEPTH_BASE = 9000;
const DEBUG_TEXT_DEPTH = 20000;

export class TownScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private localActionKeys!: Record<LocalActionInputId, Phaser.Input.Keyboard.Key>;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private unsubscribeStore?: () => void;
  private remotePlayerSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private remotePlayerNames: Map<string, Phaser.GameObjects.Text> = new Map();
  private remotePlayerTargets: Map<string, { x: number; y: number }> = new Map();
  private remotePlayerActionSequences: Map<string, number> = new Map();
  private activeRemoteActions: Map<string, LocalActionId> = new Map();
  private playerNameLabel!: Phaser.GameObjects.Text;
  private localUserId: string = "";
  private debugText!: Phaser.GameObjects.Text;
  private localCharacterId: CharacterId = "p-boy";
  private activeLocalActionId: LocalActionId | null = null;
  private wasInputFocused = false;
  private campfireAmbientController?: AmbientSoundController;

  constructor() {
    super("TownScene");
  }

  preload = () => {
    const mapLoader = useMovementStore.getState().mapLoader;
    const backgroundImage = mapLoader?.getBackgroundImage();
    const frontImage = mapLoader?.getFrontImage();

    if (backgroundImage?.visible) {
      this.load.image(MAP_BACKGROUND_KEY, backgroundImage.url);
    }

    if (frontImage?.visible) {
      this.load.image(MAP_FRONT_KEY, frontImage.url);
    }

    // 플레이어 캐릭터 스프라이트 시트 로드
    CHARACTER_OPTIONS.forEach((character) => {
      this.load.spritesheet(character.assetKey, character.assetUrl, {
        frameWidth: character.frameWidth,
        frameHeight: character.frameHeight,
      });
    });

    Object.values(CHARACTER_ACTION_CONFIGS).forEach((actionConfig) => {
      this.load.spritesheet(actionConfig.assetKey, actionConfig.assetUrl, {
        frameWidth: actionConfig.frameWidth,
        frameHeight: actionConfig.frameHeight,
      });
    });

    this.load.audio(AMBIENT_AUDIO_KEYS.CAMPFIRE, AMBIENT_AUDIO_URLS.CAMPFIRE);

    this.load.image(CAMPFIRE_BASE_ASSET_KEY, CAMPFIRE_BASE_ASSET_URL);
    this.load.spritesheet(CAMPFIRE_FLAME_ASSET_KEY, CAMPFIRE_FLAME_ASSET_URL, {
      frameWidth: CAMPFIRE_FLAME_FRAME_WIDTH,
      frameHeight: CAMPFIRE_FLAME_FRAME_HEIGHT,
    });
  };

  create = () => {
    const store = useMovementStore.getState();
    const mapLoader = store.mapLoader;
    const initialPos = store.position;
    // MovementStore에서 유저 ID 가져오기 (동기화됨)
    this.localUserId = store.userId;
    this.localCharacterId = store.characterId;
    const localCharacterConfig = getCharacterConfig(store.characterId);

    if (mapLoader) {
      const backgroundImage = mapLoader.getBackgroundImage();
      if (backgroundImage?.visible) {
        this.renderImageLayer(backgroundImage, MAP_BACKGROUND_KEY, BACKGROUND_DEPTH);
      }

      const bounds = mapLoader.getMapBounds();
      const cb = this.computeCameraBounds(
        bounds,
        this.cameras.main.width,
        this.cameras.main.height,
      );
      this.cameras.main.setBounds(cb.x, cb.y, cb.width, cb.height);
      this.cameras.main.setZoom(GAME_CONFIG.CAMERA_ZOOM);

      /** 화면 크기 변경 시 카메라 bounds를 재계산한다 */
      const handleResize = () => {
        const updated = this.computeCameraBounds(
          bounds,
          this.cameras.main.width,
          this.cameras.main.height,
        );
        this.cameras.main.setBounds(updated.x, updated.y, updated.width, updated.height);
      };
      this.scale.on(Phaser.Scale.Events.RESIZE, handleResize);
    }

    // 방향별 걷기 애니메이션 등록 (가로 3열, 세로 4행 기준)
    // 프레임 순서: 왼발 → 양발 → 오른발 → 양발 (걷는 발부터 시작하여 짧은 입력에도 발 움직임이 보임)
    const animConfig = [
      { key: "walk-down", frames: [1, 0, 2, 0] }, // 1행 (아래)
      { key: "walk-left", frames: [4, 3, 5, 3] }, // 2행 (왼쪽)
      { key: "walk-right", frames: [7, 6, 8, 6] }, // 3행 (오른쪽)
      { key: "walk-up", frames: [10, 9, 11, 9] }, // 4행 (위)
    ];

    CHARACTER_OPTIONS.forEach((character) => {
      animConfig.forEach((anim) => {
        this.anims.create({
          key: this.getAnimationKey(character, anim.key),
          frames: this.anims.generateFrameNumbers(character.assetKey, { frames: anim.frames }),
          frameRate: 6,
          repeat: -1,
        });
      });
    });

    CHARACTER_OPTIONS.forEach((character) => {
      const actionConfig = getCharacterActionConfig(character.id);
      const actionIds = Object.keys(LOCAL_ACTION_ANIMATIONS) as LocalActionId[];

      actionIds.forEach((actionId) => {
        const action = LOCAL_ACTION_ANIMATIONS[actionId];
        const animationKey = getLocalActionAnimationKey(character.id, actionId);

        if (!this.anims.exists(animationKey)) {
          this.anims.create({
            key: animationKey,
            frames: this.anims.generateFrameNumbers(actionConfig.assetKey, {
              frames: getActionFrameNumbers(actionId),
            }),
            frameRate: action.fps,
            repeat: action.repeat,
          });
        }
      });
    });

    this.player = this.add.sprite(initialPos.x, initialPos.y, localCharacterConfig.assetKey, 0); // 기본 정지 프레임(정면, 양발)
    this.applyCharacterConfig(this.player, localCharacterConfig);

    this.playerNameLabel = this.add.text(
      initialPos.x,
      initialPos.y - localCharacterConfig.labelOffsetY,
      store.nickname,
      {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 4, y: 2 },
      },
    );
    this.playerNameLabel.setOrigin(0.5, 1); // 이름표의 바닥을 기준점으로 설정
    this.syncCharacterDepth(this.player, this.playerNameLabel);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.localActionKeys = Object.fromEntries(
      (Object.keys(LOCAL_ACTION_KEY_BINDINGS) as LocalActionInputId[]).map((actionInputId) => [
        actionInputId,
        this.input.keyboard!.addKey(
          Phaser.Input.Keyboard.KeyCodes[LOCAL_ACTION_KEY_BINDINGS[actionInputId]],
          false,
        ),
      ]),
    ) as Record<LocalActionInputId, Phaser.Input.Keyboard.Key>;
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE, false);
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };

    // Phaser가 WASD 및 방향키를 캡처하도록 설정
    // 채팅창 포커스 시 update 루프에서 동적으로 제어
    this.input.keyboard!.addCapture(CAPTURED_KEYS);

    const frontImage = mapLoader?.getFrontImage();
    if (frontImage?.visible) {
      this.renderImageLayer(frontImage, MAP_FRONT_KEY, FRONT_DEPTH);
    }

    // 배경색 설정 (맵 이미지 로드 실패/바깥 영역용)
    this.cameras.main.setBackgroundColor("#c8aa78");

    // 디버그 텍스트 추가
    this.debugText = this.add
      .text(10, 10, "Debug Info", {
        fontSize: "16px",
        color: "#00ff00",
        backgroundColor: "#000000aa",
      })
      .setScrollFactor(0)
      .setDepth(DEBUG_TEXT_DEPTH);

    this.campfireAmbientController = new AmbientSoundController(
      this,
      AMBIENT_AUDIO_KEYS.CAMPFIRE,
      mapLoader ? resolveCampfireSources(mapLoader) : [],
      CAMPFIRE_SOUND_CONFIG,
    );

    if (mapLoader) {
      new CampfireEffectsController(this, resolveCampfireVisuals(mapLoader), CHARACTER_DEPTH_BASE);
    }

    this.updateRemotePlayers(store.remotePlayers);

    // Zustand 스토어 구독: 필요한 필드만 선택하여 불필요한 리렌더링 방지
    this.unsubscribeStore = useMovementStore.subscribe(
      (state) => ({
        position: state.position,
        nickname: state.nickname,
        remotePlayers: state.remotePlayers,
        userId: state.userId,
        characterId: state.characterId,
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

        if (next.characterId !== prev.characterId) {
          this.localCharacterId = next.characterId;
          if (!this.activeLocalActionId) {
            const characterConfig = getCharacterConfig(next.characterId);
            this.applyCharacterConfig(this.player, characterConfig);
          }
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
          a.userId === b.userId &&
          a.characterId === b.characterId,
      },
    );

    // 카메라가 플레이어를 화면 중앙에 오도록 고정
    this.cameras.main.startFollow(this.player, true, 1, 1);

    // Scene 종료 시 구독 해제 설정
    this.events.once("shutdown", () => {
      if (this.unsubscribeStore) this.unsubscribeStore();
      this.scale.off(Phaser.Scale.Events.RESIZE);
      this.remotePlayerSprites.clear();
      this.remotePlayerNames.clear();
      this.remotePlayerTargets.clear();
      this.campfireAmbientController?.destroy();
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
        this.remotePlayerActionSequences.delete(userId);
        this.activeRemoteActions.delete(userId);
      }
    });

    // 2. 신규/기존 플레이어 위치 업데이트
    Object.entries(remotePlayers).forEach(([userId, data]) => {
      // 본인은 원격 플레이어로 그리지 않음
      if (userId === this.localUserId) return;

      let sprite = this.remotePlayerSprites.get(userId);
      let nameLabel = this.remotePlayerNames.get(userId);
      const characterConfig = getCharacterConfig(data.characterId);

      if (!sprite) {
        if (!data.position) {
          console.warn(`[TownScene] Skipped rendering ${userId} due to missing position`, data);
          return;
        }

        // 새 플레이어 생성
        sprite = this.add.sprite(data.position.x, data.position.y, characterConfig.assetKey, 1);
        this.applyCharacterConfig(sprite, characterConfig);
        this.remotePlayerSprites.set(userId, sprite);

        nameLabel = this.add.text(
          data.position.x,
          data.position.y - characterConfig.labelOffsetY,
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
        this.syncCharacterDepth(sprite, nameLabel);
      } else {
        if (
          sprite.texture.key !== characterConfig.assetKey &&
          !this.activeRemoteActions.has(userId)
        ) {
          this.applyCharacterConfig(sprite, characterConfig);
        }

        // 기존 플레이어 닉네임 업데이트
        if (nameLabel && nameLabel.text !== data.nickname) {
          nameLabel.setText(data.nickname);
        }
      }

      // 목표 위치 업데이트 (LERP용)
      if (data.position) {
        this.remotePlayerTargets.set(userId, { x: data.position.x, y: data.position.y });
      }

      this.applyRemoteActionState(userId, sprite, data);
    });
  };

  /**
   * 매 프레임 호출되는 게임 루프
   * 타 플레이어 위치 보간(LERP), 애니메이션 처리 및 로컬 플레이어 입력 처리
   */
  update = () => {
    const store = useMovementStore.getState();

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
        const activeRemoteAction = this.activeRemoteActions.get(userId);

        // 약간의 움직임은 무시 (보간으로 인한 미세 진동)
        const isRemoteMoving = Math.abs(diffX) > 0.5 || Math.abs(diffY) > 0.5;

        if (
          activeRemoteAction &&
          LOCAL_ACTION_ANIMATIONS[activeRemoteAction].repeat === 0 &&
          !sprite.anims.isPlaying
        ) {
          this.stopRemoteAction(userId, sprite);
        } else if (activeRemoteAction && isRemoteMoving) {
          this.stopRemoteAction(userId, sprite);
        }

        if (this.activeRemoteActions.has(userId)) {
          // 액션 재생 중에는 기존 걷기/정지 애니메이션이 action atlas를 덮어쓰지 않게 유지한다.
        } else if (isRemoteMoving) {
          if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX < 0) {
              sprite.setFlipX(false);
              sprite.anims.play(this.getAnimationKeyById(userId, "walk-left"), true);
            } else {
              sprite.setFlipX(false);
              sprite.anims.play(this.getAnimationKeyById(userId, "walk-right"), true);
            }
          } else {
            if (diffY < 0) {
              sprite.anims.play(this.getAnimationKeyById(userId, "walk-up"), true);
            } else {
              sprite.anims.play(this.getAnimationKeyById(userId, "walk-down"), true);
            }
          }
        } else {
          sprite.anims.stop();
          const currentAnim = sprite.anims.currentAnim?.key;
          if (currentAnim?.endsWith("walk-left")) sprite.setFrame(3);
          else if (currentAnim?.endsWith("walk-right")) sprite.setFrame(6);
          else if (currentAnim?.endsWith("walk-up")) sprite.setFrame(9);
          else sprite.setFrame(0);
        }

        const nameLabel = this.remotePlayerNames.get(userId);
        if (nameLabel) {
          const remotePlayer = store.remotePlayers[userId];
          const characterConfig = getCharacterConfig(remotePlayer?.characterId);
          nameLabel.setPosition(sprite.x, sprite.y - characterConfig.labelOffsetY);
          this.syncCharacterDepth(sprite, nameLabel);
        }
      }
    });

    // 2. 로컬 플레이어 입력 처리
    const speed = 4;

    const isInputFocused = isEditableElementFocused();

    // 포커스 상태가 실제로 바뀐 프레임에만 캡처를 토글 (매 프레임 addCapture/removeCapture 호출 방지)
    if (this.input.keyboard && isInputFocused !== this.wasInputFocused) {
      if (isInputFocused) {
        this.input.keyboard.removeCapture(CAPTURED_KEYS);
      } else {
        this.input.keyboard.addCapture(CAPTURED_KEYS);
      }
      this.wasInputFocused = isInputFocused;
    }

    if (isInputFocused) return;

    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -speed;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) dx = speed;

    if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -speed;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) dy = speed;

    const isMoving = dx !== 0 || dy !== 0;
    const isSpacePressed = Phaser.Input.Keyboard.JustDown(this.spaceKey);
    const triggeredActionInputId = this.getTriggeredLocalActionInputId();
    const triggeredActionId = this.resolveTriggeredLocalActionId(triggeredActionInputId);
    const actionInput = resolveLocalActionInput(this.activeLocalActionId, triggeredActionId);

    if (this.activeLocalActionId && (isMoving || isSpacePressed)) {
      this.stopLocalAction();
    } else if (actionInput.type === "stop") {
      this.stopLocalAction();
    } else if (!isMoving && actionInput.type === "play") {
      this.playLocalAction(actionInput.actionId);
    }

    if (
      this.activeLocalActionId &&
      LOCAL_ACTION_ANIMATIONS[this.activeLocalActionId].repeat === 0 &&
      !this.player.anims.isPlaying
    ) {
      this.stopLocalAction();
    }

    /**
     * 액션 재생 중에는 걷기 애니메이션이 texture를 덮어쓰지 않도록 한다.
     */
    if (!this.activeLocalActionId) {
      if (isMoving) {
        // 좌우 이동과 상하 이동 중 어느 쪽이 우선인지 판단 (여기선 dx와 dy의 절대값이 같으면 좌우 우선)
        if (Math.abs(dx) >= Math.abs(dy)) {
          if (dx < 0) {
            this.player.setFlipX(false);
            this.player.anims.play(this.getAnimationKeyById(this.localUserId, "walk-left"), true);
          } else {
            this.player.setFlipX(false);
            this.player.anims.play(this.getAnimationKeyById(this.localUserId, "walk-right"), true);
          }
        } else {
          if (dy < 0) {
            this.player.anims.play(this.getAnimationKeyById(this.localUserId, "walk-up"), true);
          } else {
            this.player.anims.play(this.getAnimationKeyById(this.localUserId, "walk-down"), true);
          }
        }
      } else {
        this.player.anims.stop();
        const currentAnim = this.player.anims.currentAnim?.key;
        if (currentAnim?.endsWith("walk-left")) this.player.setFrame(3);
        else if (currentAnim?.endsWith("walk-right")) this.player.setFrame(6);
        else if (currentAnim?.endsWith("walk-up")) this.player.setFrame(9);
        else this.player.setFrame(0);
      }
    }

    if (isMoving) {
      // 위치 업데이트 요청 (검증 로직은 스토어 내부에서 실행됨)
      useMovementStore.getState().updatePosition({ x: dx, y: dy });
    }

    // 디버그 정보 업데이트
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
        this.player.y - getCharacterConfig(this.localCharacterId).labelOffsetY,
      );
      this.syncCharacterDepth(this.player, this.playerNameLabel);
    }

    // 4. 모닥불 환경음 거리 기반 볼륨 갱신
    // villageId는 이번 프레임 입력 처리(updatePosition) 이후의 최신 값을 다시 조회해 사용
    this.campfireAmbientController?.update(this.player, useMovementStore.getState().villageId);
  };

  private getAnimationKey(character: CharacterConfig, animationKey: string) {
    return `${character.assetKey}-${animationKey}`;
  }

  private getAnimationKeyById(userId: string, animationKey: string) {
    const remotePlayer = this.remotePlayerSprites.has(userId)
      ? useMovementStore.getState().remotePlayers[userId]
      : null;
    const characterConfig = getCharacterConfig(remotePlayer?.characterId ?? this.localCharacterId);

    return this.getAnimationKey(characterConfig, animationKey);
  }

  private applyCharacterConfig(
    sprite: Phaser.GameObjects.Sprite,
    characterConfig: CharacterConfig,
  ) {
    sprite.setTexture(characterConfig.assetKey, sprite.frame.name);
    sprite.setScale(characterConfig.scale);
    sprite.setOrigin(0.5, characterConfig.originY); // 모든 캐릭터는 발밑 기준으로 정렬
  }

  private getTriggeredLocalActionInputId(): LocalActionInputId | null {
    const actionInputIds = Object.keys(this.localActionKeys) as LocalActionInputId[];

    return (
      actionInputIds.find((actionInputId) =>
        Phaser.Input.Keyboard.JustDown(this.localActionKeys[actionInputId]),
      ) ?? null
    );
  }

  private resolveTriggeredLocalActionId(
    actionInputId: LocalActionInputId | null,
  ): LocalActionId | null {
    if (!actionInputId) return null;

    return actionInputId;
  }

  private playLocalAction(actionId: LocalActionId) {
    if (!this.player || !this.player.active) return;

    const actionConfig = getCharacterActionConfig(this.localCharacterId);
    const characterConfig = getCharacterConfig(this.localCharacterId);
    const action = LOCAL_ACTION_ANIMATIONS[actionId];
    const actionScale = characterConfig.frameHeight / actionConfig.visibleHeight;
    const animationKey = getLocalActionAnimationKey(this.localCharacterId, actionId);

    /**
     * 같은 액션 재입력 시에도 처음부터 재생되도록 현재 animation을 먼저 멈춘다.
     */
    this.player.anims.stop();
    this.activeLocalActionId = actionId;
    this.player.setTexture(actionConfig.assetKey, getActionFrameNumbers(actionId)[0]);
    this.player.setScale(actionScale);
    this.player.setOrigin(0.5, actionConfig.originY + action.originYOffset);
    this.player.setFlipX(false);
    useMovementStore.getState().startLocalAction(actionId);
    this.player.anims.play(animationKey);
  }

  private stopLocalAction() {
    if (!this.player || !this.player.active || !this.activeLocalActionId) return;

    this.activeLocalActionId = null;
    useMovementStore.getState().stopLocalAction();
    const nextCharacterConfig = getCharacterConfig(this.localCharacterId);
    this.applyCharacterConfig(this.player, nextCharacterConfig);
    this.player.anims.stop();
    this.player.setFrame(0);
  }

  private applyRemoteActionState(
    userId: string,
    sprite: Phaser.GameObjects.Sprite,
    remotePlayer: RemotePlayer,
  ) {
    const actionResult = resolveRemoteActionState(
      this.remotePlayerActionSequences.get(userId) ?? null,
      remotePlayer.actionState,
    );

    if (actionResult.type === "none") return;

    if (actionResult.type === "stop") {
      this.stopRemoteAction(userId, sprite);
      return;
    }

    const characterConfig = getCharacterConfig(remotePlayer.characterId);
    const actionConfig = getCharacterActionConfig(remotePlayer.characterId);
    const action = LOCAL_ACTION_ANIMATIONS[actionResult.actionId];
    const actionScale = characterConfig.frameHeight / actionConfig.visibleHeight;
    const animationKey = getLocalActionAnimationKey(
      remotePlayer.characterId,
      actionResult.actionId,
    );

    if (!this.anims.exists(animationKey)) {
      this.stopRemoteAction(userId, sprite);
      return;
    }

    sprite.anims.stop();
    sprite.setTexture(actionConfig.assetKey, getActionFrameNumbers(actionResult.actionId)[0]);
    sprite.setScale(actionScale);
    sprite.setOrigin(0.5, actionConfig.originY + action.originYOffset);
    sprite.setFlipX(false);
    sprite.anims.play(animationKey);

    this.remotePlayerActionSequences.set(userId, actionResult.sequence);
    this.activeRemoteActions.set(userId, actionResult.actionId);
  }

  private stopRemoteAction(userId: string, sprite: Phaser.GameObjects.Sprite) {
    if (!this.activeRemoteActions.has(userId)) return;

    const remotePlayer = useMovementStore.getState().remotePlayers[userId];
    const characterConfig = getCharacterConfig(remotePlayer?.characterId);

    this.activeRemoteActions.delete(userId);
    this.applyCharacterConfig(sprite, characterConfig);
    sprite.anims.stop();
    sprite.setFrame(0);
  }

  private renderImageLayer(imageLayer: MapImageLayer, assetKey: string, depth: number) {
    this.add
      .image(imageLayer.x, imageLayer.y, assetKey)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setVisible(imageLayer.visible);
  }

  /**
   * 맵이 캔버스보다 작을 때 중앙 정렬되도록 카메라 bounds를 계산한다.
   * 맵이 캔버스보다 크거나 같으면 맵 bounds를 그대로 반환한다.
   */
  private computeCameraBounds(
    mapBounds: { x: number; y: number; width: number; height: number },
    camWidth: number,
    camHeight: number,
  ) {
    const offsetX = Math.max(0, Math.floor((camWidth - mapBounds.width) / 2));
    const offsetY = Math.max(0, Math.floor((camHeight - mapBounds.height) / 2));
    return {
      x: mapBounds.x - offsetX,
      y: mapBounds.y - offsetY,
      width: Math.max(mapBounds.width, camWidth),
      height: Math.max(mapBounds.height, camHeight),
    };
  }

  /**
   * 캐릭터의 발밑 y좌표를 기준으로 렌더링 순서를 맞춘다.
   * 같은 공간에 여러 캐릭터가 있을 때 아래쪽 캐릭터가 위에 그려져 공중에 가려져 보이지 않게 한다.
   */
  private syncCharacterDepth(
    sprite: Phaser.GameObjects.Sprite,
    nameLabel?: Phaser.GameObjects.Text,
  ) {
    const spriteDepth = CHARACTER_DEPTH_BASE + sprite.y;
    sprite.setDepth(spriteDepth);
    nameLabel?.setDepth(NAME_LABEL_DEPTH_BASE + sprite.y);
  }
}
