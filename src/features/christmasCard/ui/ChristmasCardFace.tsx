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

  function updateMessage(
    textarea: HTMLTextAreaElement,
    nextValue: string,
    pastedRange?: { start: number; end: number },
  ) {
    let value = nextValue.slice(0, CHRISTMAS_CARD_MESSAGE_MAX_LENGTH);
    textarea.value = value;
    const messageArea = textarea.parentElement;
    const areaStyle = messageArea ? window.getComputedStyle(messageArea) : null;
    const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 0;
    // 마지막 한 줄을 비워두도록 부모 영역의 입력 가능 높이에서 한 줄을 제외한다.
    const availableHeight = messageArea
      ? messageArea.clientHeight -
        (Number.parseFloat(areaStyle?.paddingTop ?? "0") || 0) -
        (Number.parseFloat(areaStyle?.paddingBottom ?? "0") || 0) -
        lineHeight
      : textarea.clientHeight - lineHeight;

    let lastLineBreak = value.lastIndexOf("\n");
    while (textarea.scrollHeight > availableHeight) {
      // 기존 수동 줄바꿈을 보존하기 위해 붙여넣은 범위 안의 줄바꿈만 정리한다.
      const pastedLineBreak = pastedRange ? value.lastIndexOf("\n", pastedRange.end - 1) : -1;
      if (pastedRange && pastedLineBreak >= pastedRange.start) {
        value = `${value.slice(0, pastedLineBreak)} ${value.slice(pastedLineBreak + 1)}`;
      } else if (!pastedRange && lastLineBreak !== -1) {
        value = `${value.slice(0, lastLineBreak)} ${value.slice(lastLineBreak + 1)}`;
      } else if (pastedRange && pastedRange.end > pastedRange.start) {
        const pastedValue = value.slice(pastedRange.start, pastedRange.end);
        const lastCharacter = Array.from(pastedValue).at(-1);
        if (!lastCharacter) break;
        const nextEnd = pastedRange.end - lastCharacter.length;
        value = `${value.slice(0, nextEnd)}${value.slice(pastedRange.end)}`;
        pastedRange.end = nextEnd;
      } else {
        break;
      }
      textarea.value = value;
      lastLineBreak = value.lastIndexOf("\n");
    }

    const normalizedValue = value.replace(/[\uD800-\uDBFF]$/, "");
    onMessageChange?.(normalizedValue);
    return normalizedValue;
  }

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
      >
        <source src={CHRISTMAS_CARD_DESIGN.video} type="video/mp4" />
      </video>
      <div
        className={cn(
          "christmas-card-message-focus absolute inset-x-[12%] top-[24%] bottom-0 flex items-start justify-center rounded-2xl p-0 leading-5 [--card-message-padding:0px] sm:p-3 sm:leading-6 sm:[--card-message-padding:12px] md:leading-7 lg:p-4 lg:leading-8 lg:[--card-message-padding:16px] xl:leading-9 min-[921px]:top-[28%] min-[921px]:bottom-[calc(30%_-_1lh)] min-[1024px]:bottom-[calc(38%_-_1lh)] min-[1024px]:max-[1279px]:bottom-[calc(32%_-_1lh)] max-[920px]:top-[32%] max-[920px]:leading-5",
          editable && "christmas-card-lines",
        )}
      >
        {editable ? (
          <>
            <Textarea
              aria-label="카드 메시지 입력"
              className="relative z-10 w-full max-h-full min-h-0 resize-none overflow-hidden rounded-none border-0 bg-transparent px-1 py-0 text-left text-sm leading-5 text-[#63322d] shadow-none placeholder:text-center focus-visible:border-0 focus-visible:ring-0 sm:px-1.5 sm:py-0 sm:text-base sm:leading-6 md:text-lg md:leading-7 lg:px-2 lg:py-0 lg:text-xl lg:leading-8 xl:leading-9 max-[920px]:text-sm max-[920px]:leading-5"
              id={inputId}
              maxLength={CHRISTMAS_CARD_MESSAGE_MAX_LENGTH}
              onPaste={(event) => {
                const pastedText = event.clipboardData
                  .getData("text/plain")
                  .replace(/\r\n?/g, "\n");
                event.preventDefault();
                const textarea = event.currentTarget;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const suffix = textarea.value.slice(end);
                const insertableLength = Math.max(
                  0,
                  CHRISTMAS_CARD_MESSAGE_MAX_LENGTH - start - suffix.length,
                );
                const insertableText = pastedText.slice(0, insertableLength);
                const pastedRange = { start, end: start + insertableText.length };
                const value = updateMessage(
                  textarea,
                  `${textarea.value.slice(0, start)}${insertableText}${suffix}`,
                  pastedRange,
                );
                textarea.setSelectionRange(
                  pastedRange.end,
                  Math.min(pastedRange.end, value.length),
                );
              }}
              onChange={(event) => {
                updateMessage(event.currentTarget, event.currentTarget.value);
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
