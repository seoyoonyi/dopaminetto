"use client";

import { NicknameForm } from "@/features/auth/ui/NicknameForm";
import { SingleTownTabBlockedNotice, useSingleTownTabBlockStatus } from "@/features/singleTownTab";

export function HomeSingleTownTabGate() {
  const entryStatus = useSingleTownTabBlockStatus();

  if (entryStatus === "checking") {
    return <p className="text-center text-sm text-gray-500">타운 입장 상태를 확인하는 중...</p>;
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
