import type { SyncedActionState } from "@/features/movement/model/types";
import { CHARACTER_ACTION_CONFIGS } from "@/shared/constants";
import type { CharacterActionConfig, CharacterId } from "@/shared/types";

export const LOCAL_ACTION_KEY_BINDINGS = {
  dance: "ZERO",
  happy: "H",
  sit: "X",
} as const;

const LOCAL_ACTION_ATLAS_COLUMNS = 5;

export const LOCAL_ACTION_ANIMATIONS = {
  dance: {
    key: "dance",
    row: 1,
    frames: 5,
    fps: 6,
    repeat: -1,
    originYOffset: 0,
  },
  happy: {
    key: "happy",
    row: 0,
    frames: 4,
    fps: 10,
    repeat: 0,
    originYOffset: 0.1,
    /**
     * 4프레임 전체를 사용해 기본자세와 점프 동작을 두 번 보여준다.
     */
  },
  sit: {
    key: "sit",
    row: 2,
    frames: 4,
    fps: 4,
    repeat: -1,
    originYOffset: 0,
  },
} as const;

export type LocalActionId = keyof typeof LOCAL_ACTION_ANIMATIONS;
export type LocalActionInputId = keyof typeof LOCAL_ACTION_KEY_BINDINGS;

export type LocalActionInputResult =
  | { type: "none" }
  | { type: "stop" }
  | { type: "play"; actionId: LocalActionId };

export type RemoteActionStateResult =
  | { type: "none" }
  | { type: "stop" }
  | { type: "play"; actionId: LocalActionId; sequence: number };

export function getCharacterActionConfig(characterId: CharacterId): CharacterActionConfig {
  return CHARACTER_ACTION_CONFIGS[characterId];
}

export function getLocalActionAnimationKey(
  characterId: CharacterId,
  actionId: LocalActionId,
): string {
  const actionConfig = getCharacterActionConfig(characterId);
  const action = LOCAL_ACTION_ANIMATIONS[actionId];

  return `${actionConfig.assetKey}-${action.key}`;
}

export function getActionFrameNumbers(actionId: LocalActionId): number[] {
  const action = LOCAL_ACTION_ANIMATIONS[actionId];
  const startFrame = action.row * LOCAL_ACTION_ATLAS_COLUMNS;

  return Array.from({ length: action.frames }, (_, index) => startFrame + index);
}

export function getNextSyncedActionState(
  currentActionState: SyncedActionState,
  actionId: LocalActionId,
): SyncedActionState {
  return {
    actionId,
    sequence: (currentActionState?.sequence ?? 0) + 1,
  };
}

export function resolveRemoteActionState(
  lastHandledSequence: number | null,
  actionState: SyncedActionState,
): RemoteActionStateResult {
  if (!actionState) {
    return { type: "stop" };
  }

  if (lastHandledSequence !== null && actionState.sequence <= lastHandledSequence) {
    return { type: "none" };
  }

  return {
    type: "play",
    actionId: actionState.actionId,
    sequence: actionState.sequence,
  };
}

/**
 * 로컬 액션 키 입력에 따른 다음 동작을 결정한다.
 * 다른 액션 키는 즉시 전환하고, dance 재입력은 토글 종료로 처리한다.
 */
export function resolveLocalActionInput(
  activeActionId: LocalActionId | null,
  triggeredActionId: LocalActionId | null,
): LocalActionInputResult {
  if (!triggeredActionId) {
    return { type: "none" };
  }

  if (!activeActionId) {
    return { type: "play", actionId: triggeredActionId };
  }

  if (activeActionId === "dance" && triggeredActionId === "dance") {
    return { type: "stop" };
  }

  return { type: "play", actionId: triggeredActionId };
}
