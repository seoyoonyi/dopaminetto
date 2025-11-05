"use client";

import { useUserStore } from "@/shared/store";

export default function TownPage() {
  const { userNickname } = useUserStore();

  return (
    <>
      <h1 className="text-xl p-6">
        환영합니다, <span className="font-display font-bold">{userNickname}</span>님!
      </h1>
    </>
  );
}
