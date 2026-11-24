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
import { ArrowLeft, List, Pencil, Snowflake, Sparkle, TreePine, X } from "lucide-react";

import { useCallback, useRef, useState } from "react";
import type { RefObject } from "react";

import Image from "next/image";

import { useCardMenuPosition } from "../hooks/useCardMenuPosition";
import type { ChristmasCard, ChristmasCardPage } from "../model/christmasCard";
import { ChristmasCardFace } from "./ChristmasCardFace";
import { ChristmasCardForm } from "./ChristmasCardForm";
import { ChristmasCardGallery } from "./ChristmasCardGallery";

interface ChristmasCardDialogProps {
  open: boolean;
  position: { x: number; y: number } | null;
  boundaryRef: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onViewList?: () => void;
  nickname?: string;
  onSubmit?: (nickname: string, message: string) => Promise<void | ChristmasCard>;
  onLoadCards?: (page: number) => Promise<ChristmasCardPage>;
  userId?: string;
}

export function ChristmasCardDialog({
  open,
  position,
  boundaryRef,
  onOpenChange,
  onViewList,
  nickname = "",
  onSubmit,
  onLoadCards,
  userId,
}: ChristmasCardDialogProps) {
  const [screen, setScreen] = useState<"menu" | "writing" | "complete" | "list" | "detail">("menu");
  const [selectedCard, setSelectedCard] = useState<ChristmasCard | null>(null);
  const [page, setPage] = useState(1);
  const galleryScrollTopRef = useRef(0);
  const getGalleryScrollTop = useCallback(() => galleryScrollTopRef.current, []);
  const saveGalleryScrollTop = useCallback((scrollTop: number) => {
    galleryScrollTopRef.current = scrollTop;
  }, []);
  const requestVersion = useRef(0);
  const isFullScreen = screen !== "menu";
  const isFormScreen = screen === "writing" || screen === "complete";
  const menuRef = useRef<HTMLDivElement>(null);
  const menuLayout = useCardMenuPosition({
    active: open && !isFullScreen,
    boundaryRef,
    contentRef: menuRef,
    anchor: position,
  });
  const handleViewList = () => {
    setScreen("list");
    onViewList?.();
  };
  const closeDialog = () => {
    requestVersion.current += 1;
    setScreen("menu");
    setSelectedCard(null);
    setPage(1);
    galleryScrollTopRef.current = 0;
    onOpenChange(false);
  };
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) closeDialog();
    else onOpenChange(true);
  };
  const dialogHeader = isFullScreen ? (
    <DialogHeader className="relative min-h-10 w-full shrink-0 justify-center bg-[#b8ccda] px-5 py-4 text-left">
      <DialogTitle className="font-display flex items-center gap-2 text-sm font-semibold">
        <TreePine
          aria-hidden="true"
          className="size-4 fill-emerald-600 text-emerald-900"
          strokeWidth={1.5}
        />
        {screen === "detail"
          ? "카드 상세 보기"
          : isFormScreen
            ? "카드 작성하기"
            : screen === "list"
              ? "크리스마스 카드 목록"
              : "크리스마스 카드"}
      </DialogTitle>
      <DialogDescription className="sr-only">
        {screen === "detail"
          ? `${selectedCard?.nickname}님이 남긴 카드입니다.`
          : isFormScreen
            ? "닉네임과 메시지를 입력해 크리스마스 카드를 작성하세요."
            : screen === "list"
              ? "크리스마스 카드 목록을 확인하세요."
              : "방명록 메뉴를 선택하세요."}
      </DialogDescription>
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
    </DialogHeader>
  ) : (
    <DialogHeader className="shrink-0 items-center gap-2 px-12 pt-6 sm:text-center">
      <DialogTitle className="font-display flex items-center gap-1.5 text-[19px] font-bold whitespace-nowrap text-[#5a2a14]">
        <Snowflake aria-hidden="true" className="size-3.5 shrink-0 text-[#dda65a]" />
        크리스마스 카드
        <Snowflake aria-hidden="true" className="size-3.5 shrink-0 text-[#dda65a]" />
      </DialogTitle>
      <DialogDescription className="text-base leading-snug text-balance break-keep text-[#713b20]">
        함께한 한 해의 추억을 카드에 남겨보세요.
      </DialogDescription>
    </DialogHeader>
  );

  const screenContent =
    screen === "menu" ? (
      <div className="flex flex-col items-center gap-1.5 px-5 pb-5" key="menu">
        <div className="relative">
          <Image
            alt=""
            className="h-48 max-h-[25dvh] w-auto"
            height={1402}
            src="/assets/images/christmas-card-menu-tree.png"
            width={1122}
          />
          <Sparkle
            aria-hidden="true"
            className="absolute top-3 -left-7 size-3.5 fill-[#dda65a] text-[#dda65a]"
          />
          <Snowflake
            aria-hidden="true"
            className="absolute top-1/3 -right-8 size-4 text-[#e6d3b4]"
          />
          <Sparkle
            aria-hidden="true"
            className="absolute bottom-6 -left-9 size-3 fill-[#e6d3b4] text-[#e6d3b4]"
          />
        </div>
        <DialogFooter className="font-display w-full flex-row flex-wrap gap-2 sm:justify-center">
          <Button
            className="h-12 min-w-28 flex-1 cursor-pointer gap-1.5 rounded-lg font-bold border border-transparent bg-[#c62026] text-[13px] text-white shadow-xs hover:bg-[#a81b20] focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-[#dda65a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff8ee]"
            data-primary="true"
            onClick={() => setScreen("writing")}
            type="button"
          >
            <Pencil aria-hidden="true" /> 작성하기
          </Button>
          <Button
            className="h-12 min-w-28 flex-1 cursor-pointer gap-1.5 rounded-lg font-bold border border-[#713b20] bg-[#fff8ee] text-[13px] text-[#713b20] shadow-xs hover:bg-[#f7e7cf] hover:text-[#5a2a14] focus-visible:border-[#713b20] focus-visible:ring-2 focus-visible:ring-[#dda65a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fff8ee]"
            onClick={handleViewList}
            type="button"
            variant="outline"
          >
            <List aria-hidden="true" /> 목록 보기
          </Button>
        </DialogFooter>
      </div>
    ) : isFormScreen ? (
      <div
        className={`christmas-card-scrollbar flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto p-3 ${screen === "writing" ? "[scrollbar-gutter:stable]" : ""}`}
        data-card-writing-content
        key="writing"
      >
        <ChristmasCardForm
          nickname={nickname}
          onBack={() => {
            requestVersion.current += 1;
            setScreen("list");
          }}
          onClose={closeDialog}
          onComplete={() => setScreen("complete")}
          onSubmit={
            onSubmit
              ? async (nickname, message) => {
                  const version = requestVersion.current;
                  const card = await onSubmit(nickname, message);
                  return version === requestVersion.current ? card : undefined;
                }
              : undefined
          }
          onViewList={handleViewList}
        />
      </div>
    ) : screen === "detail" && selectedCard ? (
      <div
        className="christmas-card-scrollbar flex min-h-0 flex-col gap-3 overflow-y-auto p-6 [scrollbar-gutter:stable] sm:gap-4"
        key="detail"
      >
        <div className="shrink-0">
          <ChristmasCardFace message={selectedCard.content} />
        </div>
        <p className="shrink-0 border-b border-[#c8a88b] px-1 py-1 text-sm text-[#63322d] sm:px-0 sm:pt-0 sm:pb-2">
          From. {selectedCard.nickname}
        </p>
        <div className="flex shrink-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <time className="min-w-0 text-xs text-[#63322d]" dateTime={selectedCard.created_at}>
            {new Date(selectedCard.created_at).toLocaleString("ko-KR")}
          </time>
          <Button
            className="font-display w-full shrink-0 cursor-pointer px-2 sm:w-32"
            onClick={() => setScreen("list")}
            type="button"
            variant="outline"
          >
            <span className="flex w-full items-center justify-center gap-2 sm:justify-evenly">
              <List aria-hidden="true" />
              <span>목록 보기</span>
            </span>
          </Button>
        </div>
      </div>
    ) : screen === "list" ? (
      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 p-6" key="list">
        {onLoadCards ? (
          <div className="christmas-card-scrollbar min-h-0 flex-1 overflow-hidden">
            <ChristmasCardGallery
              userId={userId}
              onLoadCards={onLoadCards}
              onPageChange={setPage}
              getScrollTop={getGalleryScrollTop}
              onScrollTopChange={saveGalleryScrollTop}
              onSelect={(card) => {
                setSelectedCard(card);
                setScreen("detail");
              }}
              page={page}
              selectedCardId={selectedCard?.id}
            />
          </div>
        ) : (
          <>
            <p className="font-display text-lg font-semibold">아직 카드 목록을 준비하고 있어요.</p>
            <p className="text-sm text-slate-600">카드가 모이면 이곳에서 확인할 수 있어요.</p>
          </>
        )}
        <DialogFooter className="w-full shrink-0 justify-center">
          <Button
            className="font-display w-full cursor-pointer bg-[#f1c6bd] px-2 text-[#63322d] hover:bg-[#e8b2a8] sm:w-32"
            onClick={() => setScreen("writing")}
            type="button"
          >
            <span className="flex w-full items-center justify-center gap-2 sm:justify-evenly">
              <Pencil aria-hidden="true" />
              <span>카드 작성하기</span>
            </span>
          </Button>
        </DialogFooter>
      </div>
    ) : (
      <div
        className="flex w-full flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
        key="complete"
      >
        <p className="font-display text-lg font-semibold">아직 카드 목록을 준비하고 있어요.</p>
        <p className="text-sm text-slate-600">카드가 모이면 이곳에서 확인할 수 있어요.</p>
        <Button
          className="font-display cursor-pointer border-[#bfd0dd] bg-white text-slate-700 hover:bg-[#f5f9fc]"
          onClick={() => setScreen("menu")}
          type="button"
          variant="outline"
        >
          <ArrowLeft aria-hidden="true" /> 돌아가기
        </Button>
      </div>
    );

  return (
    <Dialog modal={isFullScreen} open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={`${
          isFullScreen
            ? "!top-0 !left-0 !h-dvh !max-h-dvh !w-screen !max-w-none !translate-x-0 !translate-y-0 !gap-0 !overflow-visible !rounded-none !border-0 !bg-transparent !p-0 !shadow-none !pointer-events-none sm:!max-w-none"
            : "z-40 w-76 gap-1.5 overflow-hidden outline-none rounded-2xl border-2 border-[#713b20] bg-[#fff8ee] bg-linear-to-b from-[#fff8ee] to-[#fbefdc] p-0 shadow-lg sm:max-w-76 [&_[data-slot=dialog-close]]:text-[#713b20]"
        } text-slate-800 [&_[data-slot=dialog-close]]:top-1 [&_[data-slot=dialog-close]]:right-1 [&_[data-slot=dialog-close]]:p-1 ${
          !isFullScreen
            ? `christmas-card-menu-scrollbar translate-x-0 translate-y-0 overflow-y-auto transition-none [&_[data-slot=dialog-close]]:top-2 [&_[data-slot=dialog-close]]:right-2 [&_[data-slot=dialog-close]]:grid [&_[data-slot=dialog-close]]:size-10 [&_[data-slot=dialog-close]]:place-items-center [&_[data-slot=dialog-close]]:p-0 [&_[data-slot=dialog-close]_svg]:!size-5 ${menuLayout.ready ? "" : "!animate-none"}`
            : ""
        } ${
          !isFullScreen
            ? "origin-center data-[state=open]:[--tw-enter-translate-x:0] data-[state=open]:[--tw-enter-translate-y:0.5rem] data-[state=closed]:[--tw-exit-translate-x:0] data-[state=closed]:[--tw-exit-translate-y:0.5rem]"
            : ""
        }`}
        ref={menuRef}
        onOpenAutoFocus={(event) => {
          // 트리 클릭 후 첫 버튼에 스크립트 포커스가 가면 :focus-visible 링이 항상 보이므로 메뉴는 컨테이너에 포커스한다.
          if (isFullScreen) return;
          event.preventDefault();
          menuRef.current?.focus();
        }}
        onKeyDownCapture={(event) => {
          if (!isFullScreen || event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          closeDialog();
        }}
        showCloseButton={!isFullScreen}
        showOverlay={isFullScreen}
        style={
          isFullScreen
            ? undefined
            : {
                ...menuLayout.style,
                visibility: menuLayout.ready ? "visible" : "hidden",
              }
        }
      >
        {isFullScreen ? (
          <div className="pointer-events-none flex h-dvh w-full items-center justify-center p-4 sm:p-8">
            <section
              className={`pointer-events-auto flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-[#aabfce] bg-[var(--winter-town-canvas-background)] shadow-xl sm:max-h-[calc(100dvh-4rem)] ${
                screen === "writing"
                  ? "max-w-6xl"
                  : screen === "list"
                    ? "h-[min(calc(100dvh-2rem),52.43rem)] max-w-6xl sm:h-[min(calc(100dvh-4rem),52.43rem)]"
                    : screen === "detail"
                      ? "max-w-6xl"
                      : screen === "complete"
                        ? "max-w-md"
                        : "max-w-6xl"
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
