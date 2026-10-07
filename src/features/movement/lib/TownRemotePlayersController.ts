import * as Phaser from "phaser";

import {
  LOCAL_ACTION_ANIMATIONS,
  getActionFrameNumbers,
  getCharacterActionConfig,
  getLocalActionAnimationKey,
  resolveRemoteActionState,
} from "../model/actionAnimation";
import type { LocalActionId } from "../model/actionAnimation";
import { getCharacterConfig } from "../model/config";
import type { CharacterId } from "../model/config";
import type { RemotePlayer } from "../model/types";
import { applyCharacterConfig, getAnimationKey, syncCharacterDepth } from "./characterSprite";

const BACKGROUND_RESUME_DELTA_MS = 250;
const GALMURI_FONT_FAMILY = "galmuri9";

type RemotePlayerTarget = { x: number; y: number; villageId: string };
type RemotePlayers = Record<string, RemotePlayer>;

/** 타운에서 원격 사용자의 표시 객체와 프레임별 시각 상태를 관리한다. */
export class TownRemotePlayersController {
  private readonly sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly names = new Map<string, Phaser.GameObjects.Text>();
  private readonly targets = new Map<string, RemotePlayerTarget>();
  private readonly renderedVillages = new Map<string, string>();
  private readonly actionSequences = new Map<string, number>();
  private readonly activeActions = new Map<string, LocalActionId>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** 로컬 UID 확인 후 본인·퇴장 사용자를 정리하고 위치가 확인된 원격 표시와 액션 상태를 동기화한다. */
  sync(remotePlayers: RemotePlayers, localUserId: string): void {
    if (!localUserId) return;

    const activeUserIds = new Set(Object.keys(remotePlayers));
    this.sprites.forEach((sprite, userId) => {
      if (!activeUserIds.has(userId) || userId === localUserId) {
        this.removePlayer(userId, sprite);
      }
    });

    Object.entries(remotePlayers).forEach(([userId, remotePlayer]) => {
      if (userId === localUserId) return;

      let sprite = this.sprites.get(userId);
      let nameLabel = this.names.get(userId);
      const characterConfig = getCharacterConfig(remotePlayer.characterId);

      if (!sprite) {
        if (!remotePlayer.position) {
          console.warn(
            `[TownRemotePlayersController] Skipped rendering ${userId} due to missing position`,
            remotePlayer,
          );
          return;
        }

        sprite = this.scene.add.sprite(
          remotePlayer.position.x,
          remotePlayer.position.y,
          characterConfig.assetKey,
          1,
        );
        applyCharacterConfig(sprite, characterConfig);
        this.sprites.set(userId, sprite);

        nameLabel = this.scene.add.text(
          remotePlayer.position.x,
          remotePlayer.position.y - characterConfig.labelOffsetY,
          remotePlayer.nickname,
          {
            fontFamily: GALMURI_FONT_FAMILY,
            fontSize: "12px",
            color: "#ffffff",
            backgroundColor: "#00000088",
            padding: { x: 4, y: 2 },
          },
        );
        nameLabel.setOrigin(0.5, 1); // 이름표의 아래 중앙을 캐릭터 위 위치에 맞춘다.
        this.names.set(userId, nameLabel);
        syncCharacterDepth(sprite, nameLabel);
      } else {
        if (sprite.texture.key !== characterConfig.assetKey && !this.activeActions.has(userId)) {
          applyCharacterConfig(sprite, characterConfig);
        }

        if (nameLabel && nameLabel.text !== remotePlayer.nickname) {
          nameLabel.setText(remotePlayer.nickname);
        }
      }

      if (remotePlayer.position) {
        this.targets.set(userId, {
          x: remotePlayer.position.x,
          y: remotePlayer.position.y,
          villageId: remotePlayer.villageId,
        });
      }

      this.applyRemoteActionState(userId, sprite, remotePlayer);
    });
  }

  /** 원격 위치 보간, 애니메이션 및 이름표 배치를 매 프레임 갱신한다. */
  update(remotePlayers: RemotePlayers, delta: number, localCharacterId: CharacterId): void {
    this.sprites.forEach((sprite, userId) => {
      const target = this.targets.get(userId);
      if (!target) return;

      const previousX = sprite.x;
      const previousY = sprite.y;
      const previousVillageId = this.renderedVillages.get(userId);
      // 빌리지 변경이나 긴 프레임 간격 뒤에는 화면을 가로지르는 보간을 피하고 목표 위치에 맞춘다.
      const shouldSnap =
        (previousVillageId !== undefined && previousVillageId !== target.villageId) ||
        delta > BACKGROUND_RESUME_DELTA_MS;

      if (shouldSnap) {
        sprite.setPosition(target.x, target.y);
      } else {
        const smoothingSpeed = 12;
        const alpha = 1 - Math.exp((-smoothingSpeed * delta) / 1000);
        sprite.x = Phaser.Math.Linear(sprite.x, target.x, alpha);
        sprite.y = Phaser.Math.Linear(sprite.y, target.y, alpha);
      }
      this.renderedVillages.set(userId, target.villageId);

      const remotePlayer = remotePlayers[userId];
      const characterId = remotePlayer?.characterId ?? localCharacterId;
      const activeAction = this.activeActions.get(userId);
      const diffX = sprite.x - previousX;
      const diffY = sprite.y - previousY;
      // 위치 보간으로 생기는 미세한 흔들림은 이동으로 처리하지 않는다.
      const isMoving = Math.abs(diffX) > 0.5 || Math.abs(diffY) > 0.5;

      if (
        activeAction &&
        LOCAL_ACTION_ANIMATIONS[activeAction].repeat === 0 &&
        !sprite.anims.isPlaying
      ) {
        this.stopRemoteAction(userId, sprite, characterId);
      } else if (activeAction && isMoving) {
        this.stopRemoteAction(userId, sprite, characterId);
      }

      if (this.activeActions.has(userId)) {
        // 액션 재생 중에는 걷기·정지 애니메이션으로 액션 텍스처를 덮지 않는다.
      } else if (isMoving) {
        const characterConfig = getCharacterConfig(characterId);
        if (Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX < 0) {
            sprite.setFlipX(false);
            sprite.anims.play(getAnimationKey(characterConfig, "walk-left"), true);
          } else {
            sprite.setFlipX(false);
            sprite.anims.play(getAnimationKey(characterConfig, "walk-right"), true);
          }
        } else if (diffY < 0) {
          sprite.anims.play(getAnimationKey(characterConfig, "walk-up"), true);
        } else {
          sprite.anims.play(getAnimationKey(characterConfig, "walk-down"), true);
        }
      } else {
        sprite.anims.stop();
        const currentAnimation = sprite.anims.currentAnim?.key;
        if (currentAnimation?.endsWith("walk-left")) sprite.setFrame(3);
        else if (currentAnimation?.endsWith("walk-right")) sprite.setFrame(6);
        else if (currentAnimation?.endsWith("walk-up")) sprite.setFrame(9);
        else sprite.setFrame(0);
      }

      const nameLabel = this.names.get(userId);
      if (nameLabel) {
        const characterConfig = getCharacterConfig(characterId);
        nameLabel.setPosition(sprite.x, sprite.y - characterConfig.labelOffsetY);
        syncCharacterDepth(sprite, nameLabel);
      }
    });
  }

  /** 처리기가 보유한 사용자별 표시 참조와 추적·액션 상태를 비운다. */
  destroy(): void {
    this.sprites.clear();
    this.names.clear();
    this.targets.clear();
    this.renderedVillages.clear();
    this.actionSequences.clear();
    this.activeActions.clear();
  }

  private removePlayer(userId: string, sprite: Phaser.GameObjects.Sprite): void {
    sprite.destroy();
    this.names.get(userId)?.destroy();
    this.sprites.delete(userId);
    this.names.delete(userId);
    this.targets.delete(userId);
    this.renderedVillages.delete(userId);
    this.actionSequences.delete(userId);
    this.activeActions.delete(userId);
  }

  private applyRemoteActionState(
    userId: string,
    sprite: Phaser.GameObjects.Sprite,
    remotePlayer: RemotePlayer,
  ): void {
    const result = resolveRemoteActionState(
      this.actionSequences.get(userId) ?? null,
      remotePlayer.actionState,
    );

    if (result.type === "none") return;
    if (result.type === "stop") {
      this.stopRemoteAction(userId, sprite, remotePlayer.characterId);
      return;
    }

    const characterConfig = getCharacterConfig(remotePlayer.characterId);
    const actionConfig = getCharacterActionConfig(remotePlayer.characterId);
    const action = LOCAL_ACTION_ANIMATIONS[result.actionId];
    const actionScale = characterConfig.frameHeight / actionConfig.visibleHeight;
    const animationKey = getLocalActionAnimationKey(remotePlayer.characterId, result.actionId);

    if (!this.scene.anims.exists(animationKey)) {
      this.stopRemoteAction(userId, sprite, remotePlayer.characterId);
      return;
    }

    sprite.anims.stop();
    sprite.setTexture(actionConfig.assetKey, getActionFrameNumbers(result.actionId)[0]);
    sprite.setScale(actionScale);
    sprite.setOrigin(0.5, actionConfig.originY + action.originYOffset);
    sprite.setFlipX(false);
    sprite.anims.play(animationKey);

    this.actionSequences.set(userId, result.sequence);
    this.activeActions.set(userId, result.actionId);
  }

  private stopRemoteAction(
    userId: string,
    sprite: Phaser.GameObjects.Sprite,
    characterId: CharacterId,
  ): void {
    if (!this.activeActions.has(userId)) return;

    this.activeActions.delete(userId);
    applyCharacterConfig(sprite, getCharacterConfig(characterId));
    sprite.anims.stop();
    sprite.setFrame(0);
  }
}
