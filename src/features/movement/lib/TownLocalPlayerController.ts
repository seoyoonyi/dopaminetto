import type * as Phaser from "phaser";

import {
  LOCAL_ACTION_ANIMATIONS,
  getActionFrameNumbers,
  getCharacterActionConfig,
  getLocalActionAnimationKey,
  resolveLocalActionInput,
} from "../model/actionAnimation";
import type { LocalActionId } from "../model/actionAnimation";
import { getCharacterConfig } from "../model/config";
import type { CharacterId } from "../model/config";
import type { LocalInputFrame } from "./TownInputController";
import { applyCharacterConfig, getAnimationKey } from "./characterSprite";

interface LocalPlayerCommands {
  updatePosition: (delta: { x: number; y: number }) => void;
  startLocalAction: (actionId: LocalActionId) => void;
  stopLocalAction: () => void;
}

/** 로컬 캐릭터의 이동 및 액션 표현을 관리한다. */
export class TownLocalPlayerController {
  private activeActionId: LocalActionId | null = null;

  constructor(
    private player: Phaser.GameObjects.Sprite | null,
    private readonly commands: LocalPlayerCommands,
  ) {}

  update(input: LocalInputFrame, characterId: CharacterId): void {
    const player = this.player;
    if (!player?.active) return;

    const isMoving = input.dx !== 0 || input.dy !== 0;
    const actionInput = resolveLocalActionInput(this.activeActionId, input.actionId);

    if (this.activeActionId && (isMoving || input.isSpacePressed)) {
      this.stopAction(characterId);
    } else if (actionInput.type === "stop") {
      this.stopAction(characterId);
    } else if (!isMoving && actionInput.type === "play") {
      this.playAction(actionInput.actionId, characterId);
    }

    if (
      this.activeActionId &&
      LOCAL_ACTION_ANIMATIONS[this.activeActionId].repeat === 0 &&
      !player.anims.isPlaying
    ) {
      this.stopAction(characterId);
    }

    // 액션 애니메이션이 걷기 애니메이션으로 덮이지 않도록 액션 중에는 이동 표시를 건너뛴다.
    if (!this.activeActionId) {
      if (isMoving) {
        // 대각선 입력에서 두 축의 이동량이 같으면 기존 동작대로 좌우 방향을 우선한다.
        if (Math.abs(input.dx) >= Math.abs(input.dy)) {
          if (input.dx < 0) {
            player.setFlipX(false);
            player.anims.play(getAnimationKey(getCharacterConfig(characterId), "walk-left"), true);
          } else {
            player.setFlipX(false);
            player.anims.play(getAnimationKey(getCharacterConfig(characterId), "walk-right"), true);
          }
        } else if (input.dy < 0) {
          player.anims.play(getAnimationKey(getCharacterConfig(characterId), "walk-up"), true);
        } else {
          player.anims.play(getAnimationKey(getCharacterConfig(characterId), "walk-down"), true);
        }
      } else {
        player.anims.stop();
        const currentAnimation = player.anims.currentAnim?.key;
        if (currentAnimation?.endsWith("walk-left")) player.setFrame(3);
        else if (currentAnimation?.endsWith("walk-right")) player.setFrame(6);
        else if (currentAnimation?.endsWith("walk-up")) player.setFrame(9);
        else player.setFrame(0);
      }
    }

    if (isMoving) {
      this.commands.updatePosition({ x: input.dx, y: input.dy });
    }
  }

  isActionActive(): boolean {
    return this.activeActionId !== null;
  }

  destroy(): void {
    this.activeActionId = null;
    this.player = null;
  }

  private playAction(actionId: LocalActionId, characterId: CharacterId): void {
    const player = this.player;
    if (!player?.active) return;

    const actionConfig = getCharacterActionConfig(characterId);
    const characterConfig = getCharacterConfig(characterId);
    const action = LOCAL_ACTION_ANIMATIONS[actionId];
    const actionScale = characterConfig.frameHeight / actionConfig.visibleHeight;
    const animationKey = getLocalActionAnimationKey(characterId, actionId);

    // 같은 액션을 다시 입력해도 처음부터 재생되도록 기존 애니메이션을 먼저 멈춘다.
    player.anims.stop();
    this.activeActionId = actionId;
    player.setTexture(actionConfig.assetKey, getActionFrameNumbers(actionId)[0]);
    player.setScale(actionScale);
    player.setOrigin(0.5, actionConfig.originY + action.originYOffset);
    player.setFlipX(false);
    this.commands.startLocalAction(actionId);
    player.anims.play(animationKey);
  }

  private stopAction(characterId: CharacterId): void {
    const player = this.player;
    if (!player?.active || !this.activeActionId) return;

    this.activeActionId = null;
    this.commands.stopLocalAction();
    applyCharacterConfig(player, getCharacterConfig(characterId));
    player.anims.stop();
    player.setFrame(0);
  }
}
