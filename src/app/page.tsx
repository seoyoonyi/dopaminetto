"use client";

import { useUserStore } from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { ChangeEvent, FormEvent } from "react";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const { userNickname, setUserNickname } = useUserStore();

  const isEnterButtonDisabled = userNickname.trim().length === 0;

  const handleNicknameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUserNickname(e.target.value.slice(0, 12));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (userNickname.trim()) {
      router.push("/town");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <main className="w-full max-w-md">
        <h1 className="font-display text-2xl text-center mb-4">도파민또</h1>

        <form onSubmit={handleSubmit}>
          <Input
            type="text"
            placeholder="닉네임을 입력하세요"
            value={userNickname}
            onChange={handleNicknameChange}
            className="px-4 py-2 border rounded mb-6"
          />

          <Button type="submit" disabled={isEnterButtonDisabled} className="w-full">
            타운 입장
          </Button>
        </form>
      </main>
    </div>
  );
}
