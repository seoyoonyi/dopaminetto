"use client";

import { useEffect, useState } from "react";

import { createBrowserTabId, getOrCreateTownTabId } from "../model/townTabIdentity";
import { getTownTabBlockState } from "../model/townTabLockStorage";
import type { TownTabBlockState } from "../model/types";

export type SingleTownTabBlockStatus = "checking" | TownTabBlockState;

/**
 * 첫 진입 화면에서 기존 타운 탭의 lock만 확인하고, 현재 탭을 타운 탭으로 등록하지 않는다.
 */
export function useSingleTownTabBlockStatus(): SingleTownTabBlockStatus {
  const [status, setStatus] = useState<SingleTownTabBlockStatus>("checking");

  useEffect(() => {
    const tabId = getOrCreateTownTabId(window.sessionStorage, createBrowserTabId);
    const instanceId = createBrowserTabId();
    const nextStatus = getTownTabBlockState({
      storage: window.localStorage,
      tabId,
      instanceId,
      now: Date.now(),
    });
    const pendingStatusId = window.setTimeout(() => {
      setStatus(nextStatus);
    }, 0);

    return () => {
      window.clearTimeout(pendingStatusId);
    };
  }, []);

  return status;
}
