import { useSyncExternalStore } from "react";

import { isMobileUserAgent } from "../model/mobileDevice";

export type MobileDeviceAccessStatus = "checking" | "allowed" | "blocked";

function subscribeToDeviceAccessSnapshot() {
  return () => {};
}

function getServerDeviceAccessSnapshot(): MobileDeviceAccessStatus {
  return "checking";
}

function getClientDeviceAccessSnapshot(): MobileDeviceAccessStatus {
  if (typeof navigator === "undefined") {
    return "allowed";
  }

  return isMobileUserAgent(navigator.userAgent) ? "blocked" : "allowed";
}

export function useMobileDeviceAccess(): MobileDeviceAccessStatus {
  return useSyncExternalStore(
    subscribeToDeviceAccessSnapshot,
    getClientDeviceAccessSnapshot,
    getServerDeviceAccessSnapshot,
  );
}
