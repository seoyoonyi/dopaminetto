"use client";

import { ChristmasCardDialog, createChristmasCard } from "@/features/christmasCard";
import { supabase } from "@/shared/config/supabase.client";
import { useUserInfo } from "@/shared/hooks/useUserInfo";
import { useGuestbookDialogStore } from "@/shared/store/useGuestbookDialogStore";

import type { RefObject } from "react";

async function submitChristmasCard(nickname: string, message: string): Promise<void> {
  await createChristmasCard(supabase, nickname, message);
}

export function ChristmasGuestbook({
  gameAreaRef,
}: {
  gameAreaRef: RefObject<HTMLDivElement | null>;
}) {
  const isOpen = useGuestbookDialogStore((state) => state.isOpen);
  const position = useGuestbookDialogStore((state) => state.position);
  const setOpen = useGuestbookDialogStore((state) => state.setOpen);
  const { data: user } = useUserInfo();
  const nickname =
    typeof user?.user_metadata?.nickname === "string" ? user.user_metadata.nickname : "";

  return (
    <ChristmasCardDialog
      nickname={nickname}
      boundaryRef={gameAreaRef}
      onOpenChange={setOpen}
      onSubmit={submitChristmasCard}
      open={isOpen}
      position={position}
    />
  );
}
