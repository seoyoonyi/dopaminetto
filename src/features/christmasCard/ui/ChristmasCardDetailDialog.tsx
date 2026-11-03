"use client";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { X } from "lucide-react";

import { ChristmasCardFace } from "./ChristmasCardFace";

interface ChristmasCardDetailDialogProps {
  open: boolean;
  nickname: string;
  message: string;
  onOpenChange: (open: boolean) => void;
}

export function ChristmasCardDetailDialog({
  open,
  nickname,
  message,
  onOpenChange,
}: ChristmasCardDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[min(92vw,56rem)] max-w-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>크리스마스 카드</DialogTitle>
          <DialogDescription>{nickname}님이 남긴 카드입니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 rounded-xl bg-[var(--winter-town-canvas-background)] p-4 shadow-xl sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-[#63322d]">{nickname}</p>
            <DialogClose asChild>
              <Button aria-label="닫기" className="cursor-pointer" size="icon" variant="ghost">
                <X aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
          <ChristmasCardFace message={message} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
