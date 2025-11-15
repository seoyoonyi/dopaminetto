"use client";

import { supabase } from "@/shared/config/supabase.client";
import { useUserStore } from "@/shared/store/useUserStore";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ChangeEvent, FormEvent, useState } from "react";

import { useRouter } from "next/navigation";

const handleEnterTown = async (nickname: string) => {
  const { error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) {
    throw new Error(`익명 로그인에 실패했습니다: ${signInError.message}`);
  }

  const { error: updateUserError } = await supabase.auth.updateUser({
    data: { nickname },
  });

  if (updateUserError) {
    throw new Error(`닉네임 업데이트에 실패했습니다: ${updateUserError.message}`);
  }
};

export function NicknameForm() {
  const [nickname, setNickname] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setUserNickname } = useUserStore();

  const { mutate: enterTownMutation, isPending } = useMutation({
    mutationFn: handleEnterTown,
    onSuccess: () => {
      setUserNickname(nickname);
      queryClient.invalidateQueries({ queryKey: ["userInfo"] });
      toast.success("닉네임이 저장되었습니다!");
      router.push("/town");
    },
    onError: (error) => {
      toast.error(`입장에 실패했습니다: ${error.message}`);
    },
  });

  const isEnterButtonDisabled = nickname.trim().length === 0 || isPending;

  const handleNicknameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNickname(e.target.value.slice(0, 12));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (nickname.trim()) {
      enterTownMutation(nickname);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input
        type="text"
        placeholder="닉네임을 입력하세요"
        value={nickname}
        onChange={handleNicknameChange}
        className="px-4 py-2 border rounded mb-6"
      />

      <Button type="submit" disabled={isEnterButtonDisabled} className="w-full">
        {isPending ? "입장 중..." : "타운 입장"}
      </Button>
    </form>
  );
}
