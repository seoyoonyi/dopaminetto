import type { RestoreStatus } from "@/features/movement/model/types";

export const FALLBACK_SPAWN_STABILIZE_MS = 400;

interface ResolveTownEntryGateParams {
  isReady: boolean;
  restoreStatus: RestoreStatus;
  fallbackWaitElapsed: boolean;
}

interface TownEntryGate {
  canMountEngine: boolean;
  showPreparing: boolean;
  shouldFadeIn: boolean;
}

export const resolveTownEntryGate = ({
  isReady,
  restoreStatus,
  fallbackWaitElapsed,
}: ResolveTownEntryGateParams): TownEntryGate => {
  if (!isReady || restoreStatus === "loading") {
    return {
      canMountEngine: false,
      showPreparing: true,
      shouldFadeIn: false,
    };
  }

  if (restoreStatus === "restored") {
    return {
      canMountEngine: true,
      showPreparing: false,
      shouldFadeIn: false,
    };
  }

  if (!fallbackWaitElapsed) {
    return {
      canMountEngine: false,
      showPreparing: true,
      shouldFadeIn: false,
    };
  }

  return {
    canMountEngine: true,
    showPreparing: false,
    shouldFadeIn: true,
  };
};
