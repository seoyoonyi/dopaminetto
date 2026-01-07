import { TRANSITION_ZONES, VILLAGES, VillageId } from "@/entities/village";
import { MOVEMENT_EVENT_TYPES, Position, ValidationResult } from "@/features/movement/model/types";

/**
 * 플레이어의 좌표가 마을을 벗어나지 않도록 경계값 내로 제한(Clamping)합니다.
 */
const clampPositionToVillage = (position: Position, villageId: VillageId): Position => {
  const config = VILLAGES[villageId];
  if (!config) return position;

  const { x1, y1, x2, y2 } = config.boundary;
  return {
    x: Math.max(x1, Math.min(x2, position.x)),
    y: Math.max(y1, Math.min(y2, position.y)),
  };
};

/**
 * 특정 마을 내부에 설정된 이동 구역(Transition Zone)에 진입했는지 감지합니다.
 */
const detectVillageTransition = (position: Position, villageId: VillageId) => {
  return TRANSITION_ZONES.find(
    (tz) =>
      tz.fromVillageId === villageId &&
      position.x >= tz.triggerZone.x1 &&
      position.x <= tz.triggerZone.x2 &&
      position.y >= tz.triggerZone.y1 &&
      position.y <= tz.triggerZone.y2,
  );
};

/**
 * 이동 요청에 대한 최종 검증을 수행합니다.
 * 1. 이동할 좌표가 마을 경계 내에 있는지 확인하고 조정합니다.
 * 2. 다른 마을로 이동하는 구역에 도달했는지 확인합니다.
 */
export const validateMovement = (
  currentPosition: Position,
  currentVillageId: VillageId,
  delta: Position,
): ValidationResult => {
  const rawNextPosition = {
    x: currentPosition.x + delta.x,
    y: currentPosition.y + delta.y,
  };

  // 1. 경계 확인 및 고정
  const clampedPosition = clampPositionToVillage(rawNextPosition, currentVillageId);

  // 2. 이동 구역 확인
  const transition = detectVillageTransition(clampedPosition, currentVillageId);

  if (transition) {
    return {
      nextPosition: transition.spawnPosition,
      nextVillageId: transition.toVillageId,
      event: {
        type: MOVEMENT_EVENT_TYPES.VILLAGE_CHANGE,
        fromVillageId: currentVillageId,
        toVillageId: transition.toVillageId,
      },
    };
  }

  return {
    nextPosition: clampedPosition,
    nextVillageId: currentVillageId,
    event: { type: MOVEMENT_EVENT_TYPES.NONE },
  };
};
