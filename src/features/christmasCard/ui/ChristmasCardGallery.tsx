"use client";

import { Button } from "@/shared/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/shared/ui/carousel";
import type { CarouselApi } from "@/shared/ui/carousel";

import { useEffect, useRef, useState } from "react";

import { useChristmasCardsQuery } from "../hooks/useChristmasCardsQuery";
import { CHRISTMAS_CARD_PAGE_SIZE } from "../model/christmasCard";
import type { ChristmasCard, ChristmasCardPage } from "../model/christmasCard";
import { ChristmasCardGallerySkeleton } from "./ChristmasCardGallerySkeleton";

interface ChristmasCardGalleryProps {
  page: number;
  onPageChange: (page: number) => void;
  onLoadCards: (page: number) => Promise<ChristmasCardPage>;
  onSelect: (card: ChristmasCard) => void;
  selectedCardId?: number;
}

export function ChristmasCardGallery({
  page,
  onPageChange,
  onLoadCards,
  onSelect,
  selectedCardId,
}: ChristmasCardGalleryProps) {
  const query = useChristmasCardsQuery(onLoadCards, page);
  const [api, setApi] = useState<CarouselApi>();
  const selectedCardRef = useRef<HTMLButtonElement>(null);
  const [startIndex] = useState(page - 1);
  const [totalCount, setTotalCount] = useState(0);
  if (query.data && query.data.totalCount !== totalCount) setTotalCount(query.data.totalCount);
  const totalPages = Math.max(page, 1, Math.ceil(totalCount / CHRISTMAS_CARD_PAGE_SIZE));

  useEffect(() => {
    if (!api) return;
    const onSelectPage = () => onPageChange(api.selectedScrollSnap() + 1);
    api.on("select", onSelectPage);
    return () => {
      api.off("select", onSelectPage);
    };
  }, [api, onPageChange]);

  useEffect(() => {
    selectedCardRef.current?.focus({ preventScroll: true });
  }, [api, selectedCardId]);

  return (
    <Carousel
      aria-label="크리스마스 카드 목록"
      className="flex h-full min-h-0 flex-1 flex-col"
      opts={{ startIndex, loop: false }}
      setApi={setApi}
    >
      <CarouselContent>
        {Array.from({ length: totalPages }, (_, index) => (
          <CarouselItem
            key={index}
            aria-label={`${index + 1}페이지`}
            className="min-h-[117.75rem] sm:min-h-[58.5rem] lg:min-h-[38.75rem]"
            inert={index + 1 !== page}
          >
            {index + 1 !== page ? null : query.isPending || query.isPlaceholderData ? (
              <ChristmasCardGallerySkeleton />
            ) : query.isError ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-4">
                <p className="text-sm text-[#63322d]" role="alert">
                  카드를 불러오지 못했어요.
                </p>
                <Button onClick={() => void query.refetch()} type="button" variant="outline">
                  다시 시도
                </Button>
              </div>
            ) : query.data.cards.length === 0 ? (
              <p
                className="flex min-h-64 items-center justify-center text-sm text-[#63322d]"
                role="status"
              >
                아직 작성된 카드가 없어요.
              </p>
            ) : (
              <ul className="grid grid-cols-1 grid-rows-[repeat(6,minmax(19rem,auto))] gap-3 pr-3 pb-3 sm:grid-cols-2 sm:grid-rows-[repeat(3,minmax(19rem,auto))] lg:grid-cols-3 lg:grid-rows-[repeat(2,minmax(19rem,auto))]">
                {query.data.cards.map((card) => (
                  <li key={card.id}>
                    <button
                      ref={card.id === selectedCardId ? selectedCardRef : undefined}
                      aria-label={`${card.nickname}님의 카드 보기`}
                      className="
                        relative isolate flex h-full min-h-76 w-full cursor-pointer
                        flex-col gap-4 overflow-hidden rounded-xl
                        border border-[#B5C9D8]
                        bg-transparent
                        p-4 text-left text-[#63322d]
                        shadow-[0_2px_8px_rgba(65,99,121,0.08)]
                        transition-[background-color,border-color,box-shadow]
                        duration-300 ease-out
                        hover:bg-[#D9E8F2]
                        hover:border-[#7FA6BC]
                        hover:shadow-[inset_0_0_18px_rgba(255,255,255,0.55),0_4px_18px_rgba(75,126,157,0.22)]
                        active:scale-[0.99]
                        before:pointer-events-none before:absolute before:inset-0
                        before:-z-10 before:rounded-[inherit]
                        before:bg-[url('/assets/images/christmas_card_bg.webp')]
                        before:bg-[length:512px_512px]
                        before:bg-repeat before:opacity-20
                        focus-visible:outline-2
                        focus-visible:outline-offset-2
                        focus-visible:outline-[#7FA6BC]
                      "
                      onClick={() => onSelect(card)}
                      type="button"
                    >
                      <span className="relative z-10 line-clamp-4 flex-1 whitespace-pre-wrap break-words bg-[repeating-linear-gradient(to_bottom,transparent_0_calc(1.625rem-1px),rgb(165_107_72_/_16%)_calc(1.625rem-1px)_1.625rem)] text-base leading-relaxed">
                        {card.content}
                      </span>
                      <span className="relative z-10 flex flex-col gap-1 text-sm">
                        <span className="truncate text-right font-medium">
                          From. {card.nickname}
                        </span>
                        <time className="text-right text-xs" dateTime={card.created_at}>
                          {new Date(card.created_at).toLocaleString("ko-KR")}
                        </time>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CarouselItem>
        ))}
      </CarouselContent>
      <nav
        aria-label="카드 목록 페이지"
        className="mt-auto flex items-center justify-center gap-4 pt-4"
      >
        <CarouselPrevious aria-label="이전 페이지" className="static translate-y-0 rounded-md" />
        <p aria-live="polite" className="text-sm tabular-nums text-[#63322d]">
          {page} / {totalPages}
        </p>
        <CarouselNext aria-label="다음 페이지" className="static translate-y-0 rounded-md" />
      </nav>
    </Carousel>
  );
}
