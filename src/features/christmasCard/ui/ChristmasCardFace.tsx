"use client";

import { CHRISTMAS_CARD_DESIGN } from "@/features/christmasCard/model/christmasCardDesign";
import { CHRISTMAS_CARD_MESSAGE_MAX_LENGTH } from "@/features/christmasCard/model/christmasCardMessage";
import { cn } from "@/lib/utils";
import { Textarea } from "@/shared/ui/textarea";

import { useState } from "react";

import Image from "next/image";

interface ChristmasCardFaceProps {
  message: string;
  editable?: boolean;
  inputId?: string;
  className?: string;
  onMessageChange?: (message: string) => void;
}

export function ChristmasCardFace({
  message,
  editable = false,
  inputId,
  className,
  onMessageChange,
}: ChristmasCardFaceProps) {
  const [isVideoReady, setIsVideoReady] = useState(false);

  return (
    <section
      aria-label="크리스마스 카드 미리보기"
      className={cn(
        "relative mx-auto aspect-video min-h-[180px] w-full min-w-[320px] max-w-none overflow-hidden rounded-lg border border-[#e6d3b4] bg-[#fff8ed]",
        className,
      )}
      data-card-template="true"
    >
      <Image
        alt=""
        className="object-contain"
        fill
        sizes="(max-width: 768px) 100vw, 1152px"
        src={CHRISTMAS_CARD_DESIGN.image}
      />
      <video
        aria-hidden="true"
        autoPlay
        className={`absolute inset-0 size-full min-h-[180px] min-w-[320px] object-contain motion-reduce:hidden ${isVideoReady ? "motion-safe:block" : "hidden"}`}
        loop
        muted
        onCanPlay={() => setIsVideoReady(true)}
        onError={() => setIsVideoReady(false)}
        playsInline
        poster={CHRISTMAS_CARD_DESIGN.image}
        src={CHRISTMAS_CARD_DESIGN.video}
      />
      <div
        className={cn(
          "christmas-card-message-focus absolute inset-x-[12%] top-[24%] bottom-0 flex items-start justify-center rounded-2xl p-0 leading-5 [--card-message-padding:0px] sm:p-3 sm:leading-6 sm:[--card-message-padding:12px] md:leading-7 lg:p-4 lg:leading-8 lg:[--card-message-padding:16px] xl:leading-9 min-[921px]:top-[28%] min-[921px]:bottom-[30%] min-[1024px]:bottom-[38%] max-[920px]:top-[32%] max-[920px]:leading-5",
          editable && "christmas-card-lines",
        )}
      >
        {editable ? (
          <>
            <Textarea
              aria-label="카드 메시지 입력"
              className="relative z-10 w-full max-h-full min-h-0 resize-none overflow-hidden rounded-none border-0 bg-transparent px-1 py-0 text-left text-sm leading-5 text-[#63322d] shadow-none placeholder:text-center focus-visible:border-0 focus-visible:ring-0 sm:px-1.5 sm:py-0 sm:text-base sm:leading-6 md:text-lg md:leading-7 lg:px-2 lg:py-0 lg:text-xl lg:leading-8 xl:leading-9 min-[921px]:h-full max-[920px]:text-sm max-[920px]:leading-5"
              id={inputId}
              maxLength={CHRISTMAS_CARD_MESSAGE_MAX_LENGTH}
              onChange={(event) => {
                const value = event.target.value.slice(0, CHRISTMAS_CARD_MESSAGE_MAX_LENGTH);
                onMessageChange?.(value.replace(/[\uD800-\uDBFF]$/, ""));
              }}
              value={message}
            />
            {message.length === 0 ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center px-1 pt-0 pb-0 text-center text-sm leading-5 text-[#8a8075] sm:px-1.5 sm:pt-3 sm:text-base sm:leading-6 md:text-lg md:leading-7 lg:px-2 lg:pt-4 lg:text-xl lg:leading-8 xl:leading-9 max-[920px]:text-sm max-[920px]:leading-5"
                data-card-message-placeholder
              >
                도파민또에 남기고 싶은 이야기를 180자 안에 담아보세요. 🎄
              </span>
            ) : null}
          </>
        ) : (
          <p className="size-full overflow-hidden whitespace-pre-wrap break-words p-1 text-center text-sm leading-5 text-[#63322d] sm:p-1.5 sm:text-base sm:leading-6 md:text-lg md:leading-7 lg:p-2 lg:text-xl lg:leading-8 max-[920px]:text-sm max-[920px]:leading-5">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
