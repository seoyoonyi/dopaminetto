import {
  TOWN_TAB_LOCK_STORAGE_KEY,
  createTownTabLock,
  parseTownTabLock,
  resolveTownTabLockState,
  serializeTownTabLock,
} from "./townTabLock";
import type { TownTabBlockState, TownTabLock, TownTabLockState } from "./types";

interface ClaimTownTabLockParams {
  storage: Storage;
  tabId: string;
  now: number;
}

interface ReleaseTownTabLockParams {
  storage: Storage;
  tabId: string;
}

interface GetTownTabBlockStateParams {
  storage: Storage;
  tabId: string;
  now: number;
}

/**
 * localStorage에 저장된 타운 탭 lock을 읽고, 깨진 값은 lock 없음으로 처리합니다.
 */
export function readTownTabLock(storage: Storage): TownTabLock | null {
  return parseTownTabLock(storage.getItem(TOWN_TAB_LOCK_STORAGE_KEY));
}

export function writeTownTabLock(storage: Storage, lock: TownTabLock) {
  storage.setItem(TOWN_TAB_LOCK_STORAGE_KEY, serializeTownTabLock(lock));
}

/**
 * /town 진입 탭이 lock을 획득하거나 갱신합니다. 다른 활성 탭이 있으면 기존 lock을 덮어쓰지 않습니다.
 */
export function claimTownTabLock({
  storage,
  tabId,
  now,
}: ClaimTownTabLockParams): Exclude<TownTabLockState, "available"> {
  const lock = readTownTabLock(storage);
  const state = resolveTownTabLockState({ lock, tabId, now });

  if (state === "blocked") return "blocked";

  writeTownTabLock(storage, createTownTabLock(tabId, now));

  return "owned";
}

/**
 * 첫 진입 화면은 타운 lock을 만들지 않고, 다른 활성 타운 탭이 있는지만 읽습니다.
 */
export function getTownTabBlockState({
  storage,
  tabId,
  now,
}: GetTownTabBlockStateParams): TownTabBlockState {
  const lock = readTownTabLock(storage);
  const state = resolveTownTabLockState({ lock, tabId, now });

  return state === "blocked" ? "blocked" : "active";
}

/**
 * 현재 탭이 소유한 lock만 해제해 다른 탭의 활성 lock을 지우지 않도록 합니다.
 */
export function releaseTownTabLock({ storage, tabId }: ReleaseTownTabLockParams) {
  const lock = readTownTabLock(storage);

  if (lock?.tabId === tabId) {
    storage.removeItem(TOWN_TAB_LOCK_STORAGE_KEY);
  }
}
