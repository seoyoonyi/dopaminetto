"use client";

import {
  ChristmasCardDialog,
  createChristmasCard,
  fetchChristmasCards,
} from "@/features/christmasCard";
import { supabase } from "@/shared/config/supabase.client";
import { useUserInfo } from "@/shared/hooks/useUserInfo";
import { useGuestbookDialogStore } from "@/shared/store/useGuestbookDialogStore";
import { useQueryClient } from "@tanstack/react-query";

import type { RefObject } from "react";

async function submitChristmasCard(nickname: string, message: string) {
  return createChristmasCard(supabase, nickname, message);
}

const loadChristmasCards = (page: number) => fetchChristmasCards(supabase, page);

export function ChristmasGuestbook({
  gameAreaRef,
}: {
  gameAreaRef: RefObject<HTMLDivElement | null>;
}) {
  const queryClient = useQueryClient();
  const isOpen = useGuestbookDialogStore((state) => state.isOpen);
  const position = useGuestbookDialogStore((state) => state.position);
  const setOpen = useGuestbookDialogStore((state) => state.setOpen);
  const { data: user } = useUserInfo();
  const nickname =
    typeof user?.user_metadata?.nickname === "string" ? user.user_metadata.nickname : "";

  return (
    <ChristmasCardDialog
      nickname={nickname}
      userId={user?.id}
      boundaryRef={gameAreaRef}
      onOpenChange={setOpen}
      onLoadCards={loadChristmasCards}
      onSubmit={async (nickname, message) => {
        const card = await submitChristmasCard(nickname, message);
        void queryClient.invalidateQueries({ queryKey: ["christmasCards"] });
        return card;
      }}
      open={isOpen}
      position={position}
    />
  );
}
