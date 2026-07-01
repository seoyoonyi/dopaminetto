import { MapLoader, Rect, VillageId, isVillageId } from "@/entities/village";
import {
  MOVEMENT_EVENT_TYPES,
  Position,
  RemotePlayer,
  ValidationResult,
} from "@/features/movement/model/types";

const PLAYER_COLLISION = {
  halfWidth: 6,
  height: 12,
} as const;

/**
 * DB에서 불러온 저장 위치가 현재 맵 기준으로 유효한지 검증한다.
 * villageId가 존재하고 TMJ 기반 village area와 충돌/맵 경계 기준을 통과해야 유효하다.
 */
export const isValidSavedPosition = (
  villageId: string,
  position: Position,
  mapLoader: MapLoader | null,
): boolean => {
  if (!mapLoader || !isVillageId(villageId)) return false;
  if (!isPositionWalkable(position, mapLoader)) return false;
  return mapLoader.getVillageAt(position) === villageId;
};

/**
 * 플레이어의 발밑 좌표를 기준으로 실제 충돌 박스를 만든다.
 */
const createPlayerRect = (position: Position): Rect => ({
  x: position.x - PLAYER_COLLISION.halfWidth,
  y: position.y - PLAYER_COLLISION.height,
  width: PLAYER_COLLISION.halfWidth * 2,
  height: PLAYER_COLLISION.height,
});

const rectsIntersect = (a: Rect, b: Rect) =>
  a.width > 0 &&
  a.height > 0 &&
  b.width > 0 &&
  b.height > 0 &&
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

/**
 * 플레이어가 맵 이미지 밖으로 나가지 않도록 TMJ 기반 맵 영역 안으로 제한한다.
 */
const clampPositionToMap = (position: Position, mapLoader: MapLoader): Position => {
  const bounds = mapLoader.getMapBounds();

  return {
    x: Math.max(
      bounds.x + PLAYER_COLLISION.halfWidth,
      Math.min(bounds.x + bounds.width - PLAYER_COLLISION.halfWidth, position.x),
    ),
    y: Math.max(bounds.y + PLAYER_COLLISION.height, Math.min(bounds.y + bounds.height, position.y)),
  };
};

const isPositionColliding = (position: Position, mapLoader: MapLoader) => {
  const playerRect = createPlayerRect(position);
  return mapLoader.getCollisionRects().some((rect) => rectsIntersect(playerRect, rect));
};

const isPositionWalkable = (position: Position, mapLoader: MapLoader) => {
  const clampedPosition = clampPositionToMap(position, mapLoader);
  const isInsideMap = clampedPosition.x === position.x && clampedPosition.y === position.y;
  return isInsideMap && !isPositionColliding(position, mapLoader);
};

const resolveAxisMovement = (
  currentPosition: Position,
  delta: Position,
  mapLoader: MapLoader,
): Position => {
  const nextPosition = clampPositionToMap(
    {
      x: currentPosition.x + delta.x,
      y: currentPosition.y + delta.y,
    },
    mapLoader,
  );

  if (!isPositionColliding(nextPosition, mapLoader)) {
    return nextPosition;
  }

  const xOnlyPosition = clampPositionToMap(
    { x: currentPosition.x + delta.x, y: currentPosition.y },
    mapLoader,
  );

  if (!isPositionColliding(xOnlyPosition, mapLoader)) {
    return xOnlyPosition;
  }

  const yOnlyPosition = clampPositionToMap(
    { x: currentPosition.x, y: currentPosition.y + delta.y },
    mapLoader,
  );

  if (!isPositionColliding(yOnlyPosition, mapLoader)) {
    return yOnlyPosition;
  }

  return currentPosition;
};

/**
 * 이동 요청에 대한 최종 검증을 수행한다.
 * 1. TMJ Collision/맵 경계 기준으로 이동 가능 좌표를 계산한다.
 * 2. TMJ Trigger의 VillageArea 진입 여부로 현재 village를 계산한다.
 */
export const validateMovement = (
  currentPosition: Position,
  currentVillageId: VillageId,
  delta: Position,
  mapLoader: MapLoader | null,
): ValidationResult => {
  if (!mapLoader) {
    return {
      nextPosition: currentPosition,
      nextVillageId: currentVillageId,
      event: { type: MOVEMENT_EVENT_TYPES.NONE },
    };
  }

  const nextPosition = resolveAxisMovement(currentPosition, delta, mapLoader);
  const nextVillageId = mapLoader.getVillageAt(nextPosition);

  if (nextVillageId !== currentVillageId) {
    return {
      nextPosition,
      nextVillageId,
      event: {
        type: MOVEMENT_EVENT_TYPES.VILLAGE_CHANGE,
        fromVillageId: currentVillageId,
        toVillageId: nextVillageId,
      },
    };
  }

  return {
    nextPosition,
    nextVillageId,
    event: { type: MOVEMENT_EVENT_TYPES.NONE },
  };
};

/**
 * 입장 시 다른 플레이어와 겹치지 않도록 일렬(Linear)로 배치한다.
 * - 동일한 마을에 있는 플레이어들만 체크한다.
 * - 이미 자리가 있다면 오른쪽으로 80px씩 이동하며 비어있는 자리를 찾는다.
 */
export const findSafeSpawnPosition = (
  targetPosition: Position,
  remotePlayers: Record<string, RemotePlayer> = {},
  currentVillageId: VillageId,
  mapLoader: MapLoader | null,
): Position => {
  const players = Object.values(remotePlayers).filter((p) => p.villageId === currentVillageId);

  let safeX = targetPosition.x;
  const safeY = targetPosition.y;
  let attempts = 0;
  const MAX_ATTEMPTS = 20;
  const OFFSET_X = 80;
  const OCCUPANCY_THRESHOLD = 70;

  while (attempts < MAX_ATTEMPTS) {
    const candidate = mapLoader
      ? clampPositionToMap({ x: safeX, y: safeY }, mapLoader)
      : { x: safeX, y: safeY };
    const isBlockedByMap = mapLoader ? !isPositionWalkable(candidate, mapLoader) : false;
    const isOccupied = players.some((p) => {
      const dx = p.position.x - candidate.x;
      const dy = p.position.y - candidate.y;
      return Math.sqrt(dx * dx + dy * dy) < OCCUPANCY_THRESHOLD;
    });

    if (!isBlockedByMap && !isOccupied) return candidate;

    safeX += OFFSET_X;
    attempts++;
  }

  return mapLoader ? clampPositionToMap(targetPosition, mapLoader) : targetPosition;
};
