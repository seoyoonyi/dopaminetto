/**
 * 같은 브라우저의 타운 입장 소유 탭을 localStorage에 기록할 때 사용하는 lock 값이다.
 */
export interface TownTabLock {
  tabId: string;
  instanceId: string;
  updatedAt: number;
}

export type TownTabLockState = "available" | "owned" | "blocked";

export type TownTabBlockState = "active" | "blocked";
