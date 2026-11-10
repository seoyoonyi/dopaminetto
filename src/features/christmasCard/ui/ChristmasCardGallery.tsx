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

import { useEffect, useState } from "react";

import { useChristmasCardsQuery } from "../hooks/useChristmasCardsQuery";
import { CHRISTMAS_CARD_PAGE_SIZE } from "../model/christmasCard";
import type { ChristmasCard, ChristmasCardPage } from "../model/christmasCard";

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

  return (
    <Carousel aria-label="크리스마스 카드 목록" opts={{ startIndex, loop: false }} setApi={setApi}>
      <CarouselContent>
        {Array.from({ length: totalPages }, (_, index) => (
          <CarouselItem key={index} aria-label={`${index + 1}페이지`} inert={index + 1 !== page}>
            {index + 1 !== page || query.isPending || query.isPlaceholderData ? (
              <p
                className="flex min-h-64 items-center justify-center text-sm text-[#63322d]"
                role="status"
              >
                카드를 불러오고 있어요.
              </p>
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
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {query.data.cards.map((card) => (
                  <li key={card.id}>
                    <button
                      autoFocus={card.id === selectedCardId}
                      aria-label={`${card.nickname}님의 카드 보기`}
                      className="flex h-full min-h-48 w-full cursor-pointer flex-col gap-4 rounded-xl border border-[#c8a88b] bg-[#fff8ed] p-4 text-left text-[#63322d] transition-colors hover:bg-[#ffefd9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a56b48] active:bg-[#f9e2c5]"
                      onClick={() => onSelect(card)}
                      type="button"
                    >
                      <span className="line-clamp-4 flex-1 whitespace-pre-wrap break-words text-base leading-relaxed">
                        {card.content}
                      </span>
                      <span className="flex flex-col gap-1 text-sm">
                        <span className="truncate font-medium">From. {card.nickname}</span>
                        <time className="text-xs" dateTime={card.created_at}>
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
      <nav aria-label="카드 목록 페이지" className="mt-4 flex items-center justify-center gap-4">
        <CarouselPrevious aria-label="이전 페이지" className="static translate-y-0 rounded-md" />
        <p aria-live="polite" className="text-sm tabular-nums text-[#63322d]">
          {page} / {totalPages}
        </p>
        <CarouselNext aria-label="다음 페이지" className="static translate-y-0 rounded-md" />
      </nav>
    </Carousel>
  );
}
