"use client";

import { ChristmasCardDialog } from "@/features/christmasCard";
import { useGuestbookDialogStore } from "@/shared/store/useGuestbookDialogStore";

export function ChristmasGuestbook() {
  const isOpen = useGuestbookDialogStore((state) => state.isOpen);
  const position = useGuestbookDialogStore((state) => state.position);
  const setOpen = useGuestbookDialogStore((state) => state.setOpen);

  return <ChristmasCardDialog onOpenChange={setOpen} open={isOpen} position={position} />;
}
