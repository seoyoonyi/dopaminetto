import { TOWN_TAB_ID_STORAGE_KEY } from "./townTabLock";

export function createBrowserTabId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

/**
 * sessionStorage에 탭별 ID를 보관해 같은 브라우저 안에서도 개별 탭을 구분한다.
 */
export function getOrCreateTownTabId(storage: Storage, createId: () => string): string {
  const existingTabId = storage.getItem(TOWN_TAB_ID_STORAGE_KEY);

  if (existingTabId) return existingTabId;

  const tabId = createId();
  storage.setItem(TOWN_TAB_ID_STORAGE_KEY, tabId);

  return tabId;
}
