/**
 * 마을 화면의 Phaser Scene으로 맵·카메라 초기화와 프레임별 갱신 흐름을 조율한다.
 * 맵·카메라, 로컬 입력·캐릭터 조작, 원격 캐릭터 표시는 전용 컨트롤러에 위임하고 환경음 갱신을 연결한다.
 * 캐릭터 스프라이트는 각 설정의 originY를 기준으로 정렬한다.
 */
import { useAmbientSoundStore } from "@/features/ambientSound";
import {
  AMBIENT_AUDIO_KEYS,
  AMBIENT_AUDIO_URLS,
  AmbientSoundController,
  CAMPFIRE_SOUND_CONFIG,
  resolveCampfireSources,
} from "@/features/ambientSound/phaser";
import {
  CHARACTER_OPTIONS,
  CharacterId,
  LOCAL_ACTION_ANIMATIONS,
  LocalActionId,
  getActionFrameNumbers,
  getCharacterActionConfig,
  getCharacterConfig,
  getLocalActionAnimationKey,
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
import { TownInputController } from "@/features/movement/lib/TownInputController";
import { TownLocalPlayerController } from "@/features/movement/lib/TownLocalPlayerController";
import { TownMapCameraController } from "@/features/movement/lib/TownMapCameraController";
import { TownRemotePlayersController } from "@/features/movement/lib/TownRemotePlayersController";
import {
  applyCharacterConfig,
  getAnimationKey,
  syncCharacterDepth,
} from "@/features/movement/lib/characterSprite";
import { isEditableElementFocused } from "@/features/movement/lib/domFocus";
import { resolveCampfireVisuals } from "@/features/movement/lib/resolveCampfireVisuals";
import { CHARACTER_ACTION_CONFIGS } from "@/shared/constants";
import { useSettingsDialogStore } from "@/shared/store";
import { useNicknameDialogStore } from "@/shared/store/useNicknameDialogStore";
import * as Phaser from "phaser";

const CHARACTER_DEPTH_BASE = 1000;
const GALMURI_FONT_FAMILY = "galmuri9";

export class TownScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private inputController?: TownInputController;
  private localPlayerController?: TownLocalPlayerController;
  private mapCameraController?: TownMapCameraController;
  private unsubscribeStore?: () => void;
  private remotePlayersController?: TownRemotePlayersController;
  private playerNameLabel!: Phaser.GameObjects.Text;
  private localUserId: string = "";
  private localCharacterId: CharacterId = "p-boy";
  private campfireAmbientController?: AmbientSoundController;

  constructor() {
    super("TownScene");
  }

  preload = () => {
    const mapLoader = useMovementStore.getState().mapLoader;
    TownMapCameraController.preload(this, mapLoader);

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

    this.mapCameraController = new TownMapCameraController(this, mapLoader);

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
          key: getAnimationKey(character, anim.key),
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
    applyCharacterConfig(this.player, localCharacterConfig);

    this.playerNameLabel = this.add.text(
      initialPos.x,
      initialPos.y - localCharacterConfig.labelOffsetY,
      store.nickname,
      {
        fontFamily: GALMURI_FONT_FAMILY,
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#00000088",
        padding: { x: 4, y: 2 },
      },
    );
    this.playerNameLabel.setOrigin(0.5, 1); // 이름표의 바닥을 기준점으로 설정
    syncCharacterDepth(this.player, this.playerNameLabel);

    this.inputController = new TownInputController(this.input.keyboard!);
    this.localPlayerController = new TownLocalPlayerController(this.player, {
      updatePosition: (delta) => useMovementStore.getState().updatePosition(delta),
      startLocalAction: (actionId) => useMovementStore.getState().startLocalAction(actionId),
      stopLocalAction: () => useMovementStore.getState().stopLocalAction(),
    });

    this.mapCameraController.renderFrontLayer();

    // 배경색 설정 (맵 이미지 로드 실패/바깥 영역용)
    this.cameras.main.setBackgroundColor("#c8aa78");

    this.campfireAmbientController = new AmbientSoundController(
      this,
      AMBIENT_AUDIO_KEYS.CAMPFIRE,
      mapLoader ? resolveCampfireSources(mapLoader) : [],
      CAMPFIRE_SOUND_CONFIG,
    );

    if (mapLoader) {
      new CampfireEffectsController(this, resolveCampfireVisuals(mapLoader), CHARACTER_DEPTH_BASE);
    }

    this.remotePlayersController = new TownRemotePlayersController(this);
    this.remotePlayersController.sync(store.remotePlayers, this.localUserId);

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
          this.remotePlayersController?.sync(next.remotePlayers, this.localUserId);
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
          if (!this.localPlayerController?.isActionActive()) {
            applyCharacterConfig(this.player, getCharacterConfig(next.characterId));
          }
        }

        // 타 플레이어 위치 업데이트 (참조가 변경된 경우에만)
        if (next.remotePlayers !== prev.remotePlayers) {
          this.remotePlayersController?.sync(next.remotePlayers, this.localUserId);
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
    this.mapCameraController.follow(this.player);

    // Scene 종료 시 store 구독과 각 컨트롤러가 등록한 자원을 정리한다.
    this.events.once("shutdown", () => {
      if (this.unsubscribeStore) this.unsubscribeStore();
      this.inputController?.destroy();
      this.localPlayerController?.destroy();
      this.mapCameraController?.destroy();
      this.mapCameraController = undefined;
      this.remotePlayersController?.destroy();
      this.remotePlayersController = undefined;
      this.campfireAmbientController?.destroy();
    });
  };

  /**
   * 매 프레임 호출되는 게임 루프
   * 타 플레이어 위치 보간(LERP), 애니메이션 처리 및 로컬 플레이어 입력 처리
   */
  update = (_time: number, delta: number) => {
    const store = useMovementStore.getState();

    /**
     * 1. 타 플레이어 위치 보간 및 애니메이션 처리
     * 네트워크 지연 고려하여 목표 위치까지 부드럽게 이동(LERP) 및 방향에 맞는 애니메이션 재생
     */
    this.remotePlayersController?.update(store.remotePlayers, delta, this.localCharacterId);

    // 2. 로컬 플레이어 입력 처리
    // 입력 차단은 로컬 입력에만 적용해 원격 표시와 환경음 갱신은 계속한다.
    const isInputFocused = isEditableElementFocused();
    const isSettingsOpen = useSettingsDialogStore.getState().isOpen;
    const isNicknameOpen = useNicknameDialogStore.getState().isOpen;
    const isInputBlocked = isInputFocused || isSettingsOpen || isNicknameOpen;

    const localInput = this.inputController?.read(isInputBlocked);
    if (localInput) {
      this.localPlayerController?.update(localInput, this.localCharacterId);
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
      syncCharacterDepth(this.player, this.playerNameLabel);
    }

    // 4. 모닥불 환경음 거리 기반 볼륨 갱신
    // villageId는 이번 프레임 입력 처리(updatePosition) 이후의 최신 값을 다시 조회해 사용한다.
    // 사용자 볼륨/음소거 설정은 매 프레임 store snapshot을 pull해 출력 배율로 반영한다(별도 구독 없음).
    const ambientSettings = useAmbientSoundStore.getState();
    this.campfireAmbientController?.update(
      this.player,
      useMovementStore.getState().villageId,
      ambientSettings.isMuted ? 0 : ambientSettings.volume,
    );
  };
}
