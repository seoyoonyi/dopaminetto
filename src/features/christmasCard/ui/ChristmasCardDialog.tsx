"use client";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { ArrowLeft, List, Pencil, TreePine } from "lucide-react";

import { useState } from "react";
import type { CSSProperties } from "react";

interface ChristmasCardDialogProps {
  open: boolean;
  position: { x: number; y: number } | null;
  onOpenChange: (open: boolean) => void;
  onViewList?: () => void;
}

export function ChristmasCardDialog({
  open,
  position,
  onOpenChange,
  onViewList,
}: ChristmasCardDialogProps) {
  const [isWriting, setIsWriting] = useState(false);

  return (
    <Dialog
      modal={false}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setIsWriting(false);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className={`z-40 w-48 gap-2 overflow-hidden border-[#aabfce] bg-[var(--winter-town-canvas-background)] p-0 text-slate-800 shadow-md sm:max-w-48 [&_[data-slot=dialog-close]]:top-1 [&_[data-slot=dialog-close]]:right-1 [&_[data-slot=dialog-close]]:p-1 ${
          position ? "translate-x-0 translate-y-0" : ""
        }`}
        showOverlay={false}
        style={
          position
            ? ({
                left: "clamp(0.5rem, calc(var(--anchor-x) - 6rem), calc(100vw - 12rem))",
                top: "clamp(0.5rem, calc(var(--anchor-y) - 4rem), calc(100dvh - 8rem))",
                "--anchor-x": `${position.x}px`,
                "--anchor-y": `${position.y}px`,
              } as CSSProperties)
            : undefined
        }
      >
        <DialogHeader className="min-h-10 justify-center bg-[#b8ccda] px-3 pr-10 text-left">
          <DialogTitle className="font-display flex items-center gap-2 text-sm font-semibold">
            <TreePine
              aria-hidden="true"
              className="size-4 fill-emerald-600 text-emerald-900"
              strokeWidth={1.5}
            />
            {isWriting ? "카드 작성하기" : "크리스마스 카드"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isWriting ? "카드 작성 화면은 다음 단계에서 준비할게요." : "방명록 메뉴를 선택하세요."}
          </DialogDescription>
        </DialogHeader>

        {!isWriting ? (
          <>
            <DialogFooter className="flex flex-col gap-1 p-2 sm:flex-col sm:items-stretch sm:justify-start">
              <Button
                className="h-9 w-full cursor-pointer justify-start bg-[#f1c6bd] text-[#63322d] hover:bg-[#e8b2a8]"
                data-primary="true"
                onClick={() => setIsWriting(true)}
                type="button"
              >
                <Pencil aria-hidden="true" /> 작성하기
              </Button>
              <Button
                className="h-9 w-full cursor-pointer justify-start border-[#bfd0dd] bg-white text-slate-700 hover:bg-[#f5f9fc]"
                disabled={!onViewList}
                onClick={onViewList}
                type="button"
                variant="outline"
              >
                <List aria-hidden="true" /> 목록 보기
              </Button>
              {!onViewList ? <span className="sr-only">카드 목록은 준비 중입니다.</span> : null}
            </DialogFooter>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <p className="px-2 py-1 text-sm text-slate-700">작성 기능을 곧 만날 수 있어요.</p>
            <Button
              className="cursor-pointer border-[#bfd0dd] bg-white text-slate-700 hover:bg-[#f5f9fc]"
              onClick={() => setIsWriting(false)}
              type="button"
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" /> 돌아가기
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
