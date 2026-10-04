import * as Phaser from "phaser";

import { LOCAL_ACTION_KEY_BINDINGS } from "../model/actionAnimation";
import type { LocalActionId, LocalActionInputId } from "../model/actionAnimation";

const CAPTURED_KEYS = "W,A,S,D,H,X,ZERO,UP,DOWN,LEFT,RIGHT,SPACE";
const MOVEMENT_SPEED = 4;

export interface LocalInputFrame {
  dx: number;
  dy: number;
  isSpacePressed: boolean;
  actionId: LocalActionId | null;
}

/** 키 상태, 입력 차단과 Phaser 키 캡처를 관리한다. */
export class TownInputController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private actionKeys: Record<LocalActionInputId, Phaser.Input.Keyboard.Key>;
  private wasd: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private wasInputBlocked = false;
  private keyboard: Phaser.Input.Keyboard.KeyboardPlugin | null;

  constructor(keyboard: Phaser.Input.Keyboard.KeyboardPlugin) {
    this.keyboard = keyboard;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys("W,A,S,D") as Record<
      "W" | "A" | "S" | "D",
      Phaser.Input.Keyboard.Key
    >;
    this.actionKeys = Object.fromEntries(
      (Object.keys(LOCAL_ACTION_KEY_BINDINGS) as LocalActionInputId[]).map((inputId) => [
        inputId,
        keyboard.addKey(
          Phaser.Input.Keyboard.KeyCodes[LOCAL_ACTION_KEY_BINDINGS[inputId].code],
          false,
        ),
      ]),
    ) as Record<LocalActionInputId, Phaser.Input.Keyboard.Key>;

    keyboard.addCapture(CAPTURED_KEYS);
  }

  /** 입력이 허용되면 현재 프레임 입력을 반환하고, 차단 중이면 키 이벤트를 소비하지 않는다. */
  read(isBlocked: boolean): LocalInputFrame | null {
    const keyboard = this.keyboard;
    if (!keyboard) return null;

    if (isBlocked !== this.wasInputBlocked) {
      if (isBlocked) {
        keyboard.removeCapture(CAPTURED_KEYS);
      } else {
        keyboard.addCapture(CAPTURED_KEYS);
      }
      this.wasInputBlocked = isBlocked;
    }

    if (isBlocked) return null;

    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) dx = -MOVEMENT_SPEED;
    else if (this.cursors.right.isDown || this.wasd.D.isDown) dx = MOVEMENT_SPEED;

    if (this.cursors.up.isDown || this.wasd.W.isDown) dy = -MOVEMENT_SPEED;
    else if (this.cursors.down.isDown || this.wasd.S.isDown) dy = MOVEMENT_SPEED;

    const triggeredActionInputId = (Object.keys(this.actionKeys) as LocalActionInputId[]).find(
      (inputId) => Phaser.Input.Keyboard.JustDown(this.actionKeys[inputId]),
    );

    return {
      dx,
      dy,
      isSpacePressed: Phaser.Input.Keyboard.JustDown(this.cursors.space),
      actionId: triggeredActionInputId ?? null,
    };
  }

  /** 이 컨트롤러가 등록한 키 캡처와 참조를 정리한다. */
  destroy(): void {
    if (!this.keyboard) return;

    this.keyboard.removeCapture(CAPTURED_KEYS);
    this.keyboard.removeCapture(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.keyboard = null;
  }
}
