import { TRANSITION_ZONES, VILLAGES, VillageId } from "@/entities/village";
import {
  MOVEMENT_EVENT_TYPES,
  Position,
  RemotePlayer,
  ValidationResult,
} from "@/features/movement/model/types";

/**
 * 플레이어의 좌표가 마을을 벗어나지 않도록 경계값 내로 제한(Clamping)합니다.
 */
const clampPositionToVillage = (position: Position, villageId: VillageId): Position => {
  const config = VILLAGES[villageId];
  if (config) {
    const { x1, y1, x2, y2 } = config.boundary;
    return {
      x: Math.max(x1, Math.min(x2, position.x)),
      y: Math.max(y1, Math.min(y2, position.y)),
    };
  }

  return {
    x: Math.max(0, Math.min(800, position.x)),
    y: Math.max(0, Math.min(600, position.y)),
  };
};

/**
 * 특정 마을 내부에 설정된 이동 구역(Transition Zone)에 진입했는지 감지합니다.
 */
const isTransitionDirectionMatched = (
  fromVillageId: VillageId,
  toVillageId: VillageId,
  delta: Position,
) => {
  if (fromVillageId === "lobby" && toVillageId !== "lobby") return delta.y < 0;
  if (fromVillageId !== "lobby" && toVillageId === "lobby") return delta.y > 0;
  if (fromVillageId === "village-a" && toVillageId === "village-b") return delta.x > 0;
  if (fromVillageId === "village-b" && toVillageId === "village-a") return delta.x < 0;
  return true;
};

const detectVillageTransition = (position: Position, villageId: VillageId, delta: Position) => {
  return TRANSITION_ZONES.find(
    (tz) =>
      tz.fromVillageId === villageId &&
      isTransitionDirectionMatched(tz.fromVillageId, tz.toVillageId, delta) &&
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

  const clampedPosition = clampPositionToVillage(rawNextPosition, currentVillageId);

  const transition = detectVillageTransition(clampedPosition, currentVillageId, delta);

  if (transition) {
    const targetVillageClamp = clampPositionToVillage(clampedPosition, transition.toVillageId);

    return {
      nextPosition: targetVillageClamp,
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

/**
 * 입장 시 다른 플레이어와 겹치지 않도록 일렬(Linear)로 배치합니다.
 * - 동일한 마을에 있는 플레이어들만 체크합니다.
 * - 이미 자리가 있다면 오른쪽으로 40px씩 이동하며 비어있는 자리를 찾습니다.
 */
export const findSafeSpawnPosition = (
  targetPosition: Position,
  remotePlayers: Record<string, RemotePlayer> = {},
  currentVillageId: VillageId,
): Position => {
  const players = Object.values(remotePlayers).filter((p) => p.villageId === currentVillageId);

  if (players.length === 0) return targetPosition;

  let safeX = targetPosition.x;
  const safeY = targetPosition.y;
  let attempts = 0;
  const MAX_ATTEMPTS = 20;
  const OFFSET_X = 40;
  const OCCUPANCY_THRESHOLD = 30;

  while (attempts < MAX_ATTEMPTS) {
    const isOccupied = players.some((p) => {
      const dx = p.position.x - safeX;
      const dy = p.position.y - safeY;
      return Math.sqrt(dx * dx + dy * dy) < OCCUPANCY_THRESHOLD;
    });

    if (!isOccupied) break;

    safeX += OFFSET_X;
    attempts++;
  }

  const finalPosition = { x: safeX, y: safeY };
  return clampPositionToVillage(finalPosition, currentVillageId);
};
