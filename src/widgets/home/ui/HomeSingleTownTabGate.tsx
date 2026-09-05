"use client";

import { NicknameForm } from "@/features/auth/ui/NicknameForm";
import { MobileAccessBlockedNotice, useMobileDeviceAccess } from "@/features/deviceAccess";
import { SingleTownTabBlockedNotice, useSingleTownTabBlockStatus } from "@/features/singleTownTab";

export function HomeSingleTownTabGate() {
  const mobileAccess = useMobileDeviceAccess();

  if (mobileAccess === "checking") {
    return (
      <p className="font-display text-center text-sm text-gray-500">접속 환경을 확인하는 중...</p>
    );
  }

  if (mobileAccess === "blocked") {
    return (
      <>
        <h1 className="font-display mb-4 text-center text-2xl">도파민또</h1>
        <MobileAccessBlockedNotice />
      </>
    );
  }

  return <HomeSingleTownTabGateContent />;
}

function HomeSingleTownTabGateContent() {
  const entryStatus = useSingleTownTabBlockStatus();

  if (entryStatus === "checking") {
    return (
      <p className="font-display text-center text-sm text-gray-500">
        타운 입장 상태를 확인하는 중...
      </p>
    );
  }

  if (entryStatus === "blocked") {
    return <SingleTownTabBlockedNotice />;
  }

  return (
    <>
      <h1 className="font-display text-2xl text-center mb-4">도파민또</h1>
      <NicknameForm />
    </>
  );
}
