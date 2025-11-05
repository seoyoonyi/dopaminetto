"use client";

import { useUserStore } from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { ChangeEvent, KeyboardEvent } from "react";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const { userNickname, setUserNickname } = useUserStore();

  const handleNicknameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 12) {
      setUserNickname(value);
    }
  };

  const handleEnterTown = () => {
    if (userNickname.trim()) {
      router.push("/town");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleEnterTown();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <main className="w-full max-w-md">
        <h1 className="font-display text-2xl text-center mb-4">도파민또</h1>

        <Input
          type="text"
          placeholder="닉네임을 입력하세요"
          value={userNickname || ""}
          onChange={handleNicknameChange}
          onKeyDown={handleKeyDown}
          className="px-4 py-2 border rounded mb-6"
          maxLength={12}
        />

        <Button onClick={handleEnterTown} disabled={!userNickname.trim()} className="w-full">
          타운 입장
        </Button>
      </main>
    </div>
  );
}
