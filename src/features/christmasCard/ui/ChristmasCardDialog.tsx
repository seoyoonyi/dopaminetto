"use client";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { ArrowLeft, List, Pencil, TreePine, X } from "lucide-react";

import { useState } from "react";
import type { CSSProperties } from "react";

import { ChristmasCardForm } from "./ChristmasCardForm";

interface ChristmasCardDialogProps {
  open: boolean;
  position: { x: number; y: number } | null;
  onOpenChange: (open: boolean) => void;
  onViewList?: () => void;
  nickname?: string;
  onSubmit?: (nickname: string, message: string) => Promise<void>;
}

export function ChristmasCardDialog({
  open,
  position,
  onOpenChange,
  onViewList,
  nickname = "",
  onSubmit,
}: ChristmasCardDialogProps) {
  const [screen, setScreen] = useState<"menu" | "writing" | "list">("menu");
  const isFullScreen = screen !== "menu";
  const dialogHeader = (
    <DialogHeader
      className={`relative min-h-10 shrink-0 justify-center bg-[#b8ccda] px-3 pr-10 text-left ${
        isFullScreen ? "w-full px-5 py-4" : ""
      }`}
    >
      <DialogTitle className="font-display flex items-center gap-2 text-sm font-semibold">
        <TreePine
          aria-hidden="true"
          className="size-4 fill-emerald-600 text-emerald-900"
          strokeWidth={1.5}
        />
        {screen === "writing"
          ? "카드 작성하기"
          : screen === "list"
            ? "크리스마스 카드 목록"
            : "크리스마스 카드"}
      </DialogTitle>
      <DialogDescription className="sr-only">
        {screen === "writing"
          ? "닉네임과 메시지를 입력해 크리스마스 카드를 작성하세요."
          : screen === "list"
            ? "크리스마스 카드 목록을 확인하세요."
            : "방명록 메뉴를 선택하세요."}
      </DialogDescription>
      {isFullScreen ? (
        <DialogClose asChild>
          <Button
            aria-label="닫기"
            className="absolute top-2 right-2 cursor-pointer"
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </DialogClose>
      ) : null}
    </DialogHeader>
  );

  const screenContent =
    screen === "menu" ? (
      <DialogFooter className="font-display flex flex-col gap-1 p-2 sm:flex-col sm:items-stretch sm:justify-start">
        <Button
          className="h-9 w-full cursor-pointer justify-start bg-[#f1c6bd] text-[#63322d] hover:bg-[#e8b2a8]"
          data-primary="true"
          onClick={() => setScreen("writing")}
          type="button"
        >
          <Pencil aria-hidden="true" /> 작성하기
        </Button>
        <Button
          className="h-9 w-full cursor-pointer justify-start border-[#bfd0dd] bg-white text-slate-700 hover:bg-[#f5f9fc]"
          onClick={() => {
            setScreen("list");
            onViewList?.();
          }}
          type="button"
          variant="outline"
        >
          <List aria-hidden="true" /> 목록 보기
        </Button>
      </DialogFooter>
    ) : screen === "writing" ? (
      <div
        className="flex w-full shrink-0 flex-col items-center justify-center p-3"
        data-card-writing-content
      >
        <ChristmasCardForm
          nickname={nickname}
          onBack={() => setScreen("menu")}
          onSubmit={onSubmit}
        />
      </div>
    ) : (
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="font-display text-lg font-semibold">아직 카드 목록을 준비하고 있어요.</p>
        <p className="text-sm text-slate-600">카드가 모이면 이곳에서 확인할 수 있어요.</p>
        <Button
          className="cursor-pointer border-[#bfd0dd] bg-white text-slate-700 hover:bg-[#f5f9fc]"
          onClick={() => setScreen("menu")}
          type="button"
          variant="outline"
        >
          <ArrowLeft aria-hidden="true" /> 돌아가기
        </Button>
      </div>
    );

  return (
    <Dialog
      modal={isFullScreen}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setScreen("menu");
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className={`${
          isFullScreen
            ? "!top-0 !left-0 !h-dvh !max-h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 !gap-0 !overflow-visible !rounded-none !border-0 !bg-transparent !p-0 !shadow-none !pointer-events-none sm:!max-w-none"
            : "z-40 w-48 gap-2 overflow-hidden border-[#aabfce] bg-[var(--winter-town-canvas-background)] p-0 shadow-md sm:max-w-48"
        } text-slate-800 [&_[data-slot=dialog-close]]:top-1 [&_[data-slot=dialog-close]]:right-1 [&_[data-slot=dialog-close]]:p-1 ${
          position && !isFullScreen ? "translate-x-0 translate-y-0" : ""
        }`}
        showCloseButton={!isFullScreen}
        showOverlay={isFullScreen}
        style={
          position && !isFullScreen
            ? ({
                left: "clamp(0.5rem, calc(var(--anchor-x) - 6rem), calc(100vw - 12rem))",
                top: "clamp(0.5rem, calc(var(--anchor-y) - 4rem), calc(100dvh - 8rem))",
                "--anchor-x": `${position.x}px`,
                "--anchor-y": `${position.y}px`,
              } as CSSProperties)
            : undefined
        }
      >
        {isFullScreen ? (
          <div className="pointer-events-none flex h-dvh w-full items-center justify-center p-4 sm:p-8">
            <section
              className={`pointer-events-auto flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-y-auto rounded-xl border border-[#aabfce] bg-[var(--winter-town-canvas-background)] shadow-xl sm:max-h-[calc(100dvh-4rem)] ${
                screen === "writing" ? "max-w-6xl" : "max-w-md"
              }`}
            >
              {dialogHeader}
              {screenContent}
            </section>
          </div>
        ) : (
          <>
            {dialogHeader}
            {screenContent}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
