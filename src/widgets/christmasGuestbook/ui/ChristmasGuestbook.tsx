"use client";

import { ChristmasCardDialog } from "@/features/christmasCard";
import { useUserInfo } from "@/shared/hooks/useUserInfo";
import { useGuestbookDialogStore } from "@/shared/store/useGuestbookDialogStore";

export function ChristmasGuestbook() {
  const isOpen = useGuestbookDialogStore((state) => state.isOpen);
  const position = useGuestbookDialogStore((state) => state.position);
  const setOpen = useGuestbookDialogStore((state) => state.setOpen);
  const { data: user } = useUserInfo();
  const nickname =
    typeof user?.user_metadata?.nickname === "string" ? user.user_metadata.nickname : "";

  return (
    <ChristmasCardDialog
      nickname={nickname}
      onOpenChange={setOpen}
      open={isOpen}
      position={position}
    />
  );
}
