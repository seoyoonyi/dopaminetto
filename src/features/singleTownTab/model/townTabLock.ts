import type { TownTabLock, TownTabLockState } from "./types";

/**
 * 다른 탭이 비정상 종료되어 release를 못 해도 현재 탭이 다시 입장할 수 있게 하는 lock 유효 시간이다.
 */
export const DEFAULT_TOWN_TAB_LOCK_TTL_MS = 5_000;
export const TOWN_TAB_LOCK_STORAGE_KEY = "dopaminetto:town-tab-lock";
export const TOWN_TAB_ID_STORAGE_KEY = "dopaminetto:town-tab-id";

interface ResolveTownTabLockStateParams {
  lock: TownTabLock | null;
  tabId: string;
  instanceId: string;
  now: number;
  ttlMs?: number;
}

export function createTownTabLock(tabId: string, instanceId: string, now: number): TownTabLock {
  return {
    tabId,
    instanceId,
    updatedAt: now,
  };
}

export function serializeTownTabLock(lock: TownTabLock): string {
  return JSON.stringify(lock);
}

/**
 * localStorage 값은 사용자가 직접 수정하거나 이전 버전 값이 남을 수 있어, 유효하지 않으면 lock 없음으로 처리한다.
 */
export function parseTownTabLock(value: string | null): TownTabLock | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "tabId" in parsed &&
      "instanceId" in parsed &&
      "updatedAt" in parsed &&
      typeof parsed.tabId === "string" &&
      typeof parsed.instanceId === "string" &&
      typeof parsed.updatedAt === "number"
    ) {
      return {
        tabId: parsed.tabId,
        instanceId: parsed.instanceId,
        updatedAt: parsed.updatedAt,
      };
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * 현재 탭이 타운 lock을 획득할 수 있는지, 이미 소유 중인지, 다른 활성 탭 때문에 차단되는지 판정한다.
 */
export function resolveTownTabLockState({
  lock,
  tabId,
  instanceId,
  now,
  ttlMs = DEFAULT_TOWN_TAB_LOCK_TTL_MS,
}: ResolveTownTabLockStateParams): TownTabLockState {
  if (!lock) return "available";
  if (lock.tabId === tabId && lock.instanceId === instanceId) return "owned";

  const isActive = now - lock.updatedAt <= ttlMs;

  return isActive ? "blocked" : "available";
}
