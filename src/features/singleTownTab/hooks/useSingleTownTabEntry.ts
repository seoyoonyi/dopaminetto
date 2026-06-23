"use client";

import { useEffect, useState } from "react";

import { createBrowserTabId, getOrCreateTownTabId } from "../model/townTabIdentity";
import { DEFAULT_TOWN_TAB_LOCK_TTL_MS } from "../model/townTabLock";
import { claimTownTabLock, releaseTownTabLock } from "../model/townTabLockStorage";

export type SingleTownTabEntryStatus = "checking" | "active" | "blocked";

const TOWN_TAB_HEARTBEAT_MS = Math.floor(DEFAULT_TOWN_TAB_LOCK_TTL_MS / 2);

/**
 * /town에서 현재 탭을 활성 타운 탭으로 등록하고, 주기적으로 lock을 갱신하며 탭 종료 시 해제한다.
 */
export function useSingleTownTabEntry(): SingleTownTabEntryStatus {
  const [status, setStatus] = useState<SingleTownTabEntryStatus>("checking");

  useEffect(() => {
    let pendingStatusId: number | null = null;
    const updateStatus = (nextStatus: SingleTownTabEntryStatus) => {
      pendingStatusId = window.setTimeout(() => {
        setStatus(nextStatus);
      }, 0);
    };

    const tabId = getOrCreateTownTabId(window.sessionStorage, createBrowserTabId);
    const claimResult = claimTownTabLock({
      storage: window.localStorage,
      tabId,
      now: Date.now(),
    });

    if (claimResult === "blocked") {
      updateStatus("blocked");
      return () => {
        if (pendingStatusId !== null) {
          window.clearTimeout(pendingStatusId);
        }
      };
    }

    updateStatus("active");

    const heartbeatId = window.setInterval(() => {
      const heartbeatResult = claimTownTabLock({
        storage: window.localStorage,
        tabId,
        now: Date.now(),
      });

      if (heartbeatResult === "blocked") {
        updateStatus("blocked");
        window.clearInterval(heartbeatId);
      }
    }, TOWN_TAB_HEARTBEAT_MS);

    const releaseCurrentTabLock = () => {
      releaseTownTabLock({
        storage: window.localStorage,
        tabId,
      });
    };

    window.addEventListener("pagehide", releaseCurrentTabLock);

    return () => {
      if (pendingStatusId !== null) {
        window.clearTimeout(pendingStatusId);
      }
      window.clearInterval(heartbeatId);
      window.removeEventListener("pagehide", releaseCurrentTabLock);
      releaseCurrentTabLock();
    };
  }, []);

  return status;
}
