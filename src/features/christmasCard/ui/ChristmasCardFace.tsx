"use client";

import { CHRISTMAS_CARD_DESIGN } from "@/features/christmasCard/model/christmasCardDesign";
import {
  CHRISTMAS_CARD_MESSAGE_MAX_LENGTH,
  CHRISTMAS_CARD_MESSAGE_MAX_LINES,
} from "@/features/christmasCard/model/christmasCardMessage";
import { cn } from "@/lib/utils";
import { Textarea } from "@/shared/ui/textarea";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";

import Image from "next/image";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function getMotionPreference() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getServerMotionPreference() {
  return true;
}

interface ChristmasCardFaceProps {
  message: string;
  editable?: boolean;
  inputId?: string;
  className?: string;
  onMessageChange?: (message: string) => void;
  onCompositionDraftChange?: (message: string | null) => void;
  onComposingChange?: (isComposing: boolean) => void;
}

export function ChristmasCardFace({
  message,
  editable = false,
  inputId,
  className,
  onMessageChange,
  onCompositionDraftChange,
  onComposingChange,
}: ChristmasCardFaceProps) {
  const [compositionDraft, setCompositionDraft] = useState<string | null>(null);
  const composition = useRef<{ value: string; start: number; end: number } | null>(null);
  const selectionBeforeInput = useRef<{ start: number; end: number } | null>(null);
  const completedComposition = useRef<{
    candidate: string;
    value: string;
    selection: { start: number; end: number } | null;
  } | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const subscribeToMotionPreference = useCallback((onChange: () => void) => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = () => {
      setIsVideoReady(false);
      onChange();
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
  const isMotionReduced = useSyncExternalStore(
    subscribeToMotionPreference,
    getMotionPreference,
    getServerMotionPreference,
  );

  function updateMessage(textarea: HTMLTextAreaElement, nextValue: string) {
    const normalizedValue = nextValue
      .slice(0, CHRISTMAS_CARD_MESSAGE_MAX_LENGTH)
      .replace(/[\uD800-\uDBFF]$/, "");
    if (textarea.value !== normalizedValue) textarea.value = normalizedValue;
    onMessageChange?.(normalizedValue);
    return normalizedValue;
  }

  function finishComposition(textarea: HTMLTextAreaElement) {
    const previous = composition.current;
    if (!previous) return;
    const candidate = textarea.value;
    const value =
      candidate.length > CHRISTMAS_CARD_MESSAGE_MAX_LENGTH
        ? previous.value
        : updateMessage(textarea, candidate);
    textarea.value = value;
    if (value !== candidate) textarea.setSelectionRange(previous.start, previous.end);
    completedComposition.current = {
      candidate,
      value,
      selection: value !== candidate ? previous : null,
    };
    composition.current = null;
    setCompositionDraft(null);
    onCompositionDraftChange?.(null);
    onComposingChange?.(false);
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
      {!isMotionReduced ? (
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
      ) : null}
      <div
        className={cn(
          "christmas-card-message-focus absolute inset-x-[12%] top-[24%] -translate-y-[clamp(8px,1.5vw,20px)] h-[calc(var(--card-message-lines)*1lh_+_18px)] flex items-start justify-center rounded-2xl p-0 leading-5 [--card-message-padding:0px] sm:h-[calc(var(--card-message-lines)*1lh_+_42px)] sm:p-3 sm:leading-6 sm:[--card-message-padding:12px] md:leading-7 lg:h-[calc(var(--card-message-lines)*1lh_+_50px)] lg:p-4 lg:leading-8 lg:[--card-message-padding:16px] xl:leading-9 min-[921px]:top-[28%] max-[920px]:top-[32%] max-[920px]:leading-5 [@media(min-width:500px)_and_(max-width:540px)]:h-[calc(var(--card-message-lines)*1lh_+_22px)] [@media(max-width:920px)]:top-[calc(32%_-_0.5lh)]",
          "christmas-card-lines",
        )}
        style={{ "--card-message-lines": CHRISTMAS_CARD_MESSAGE_MAX_LINES } as CSSProperties}
      >
        {editable ? (
          <>
            <Textarea
              aria-label="카드 메시지 입력"
              className="relative z-10 h-full w-full max-h-full min-h-0 field-sizing-fixed resize-none overflow-hidden rounded-none border-0 bg-transparent px-1 py-0 text-center text-sm leading-5 text-[#63322d] shadow-none placeholder:text-center focus-visible:border-0 focus-visible:ring-0 sm:px-1.5 sm:py-0 sm:text-base sm:leading-6 md:text-lg md:leading-7 lg:px-2 lg:py-0 lg:text-xl lg:leading-8 xl:leading-9 max-[920px]:text-sm max-[920px]:leading-5 [@media(min-width:500px)_and_(max-width:540px)]:!text-[0.84375rem] [@media(min-width:541px)_and_(max-width:711px)]:!text-[0.875rem] [@media(min-width:712px)_and_(max-width:920px)]:!text-[1rem]"
              id={inputId}
              onCompositionStart={(event) => {
                const textarea = event.currentTarget;
                composition.current = {
                  value: message,
                  start: textarea.selectionStart,
                  end: textarea.selectionEnd,
                };
                selectionBeforeInput.current = null;
                completedComposition.current = null;
                setCompositionDraft(textarea.value);
                onCompositionDraftChange?.(textarea.value);
                onComposingChange?.(true);
              }}
              onKeyDown={(event) => {
                if (
                  composition.current ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.altKey ||
                  (event.key.length !== 1 && event.key !== "Enter")
                ) {
                  return;
                }
                selectionBeforeInput.current = {
                  start: event.currentTarget.selectionStart,
                  end: event.currentTarget.selectionEnd,
                };
              }}
              onBeforeInput={(event) => {
                if (composition.current) return;
                selectionBeforeInput.current = {
                  start: event.currentTarget.selectionStart,
                  end: event.currentTarget.selectionEnd,
                };
              }}
              onCompositionEnd={(event) => finishComposition(event.currentTarget)}
              onBlur={(event) => finishComposition(event.currentTarget)}
              onPaste={(event) => {
                selectionBeforeInput.current = null;
                if (composition.current) {
                  event.preventDefault();
                  return;
                }
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
                const value = updateMessage(
                  textarea,
                  `${textarea.value.slice(0, start)}${insertableText}${suffix}`,
                );
                textarea.setSelectionRange(
                  start + insertableText.length,
                  Math.min(start + insertableText.length, value.length),
                );
              }}
              onChange={(event) => {
                const textarea = event.currentTarget;
                const previousSelection = selectionBeforeInput.current;
                selectionBeforeInput.current = null;
                if (composition.current) {
                  setCompositionDraft(textarea.value);
                  onCompositionDraftChange?.(textarea.value);
                  return;
                }
                // 조합 종료 직후 뒤따르는 input이 거절한 후보를 다시 삽입하지 않게 한다.
                const completed = completedComposition.current;
                completedComposition.current = null;
                if (completed && textarea.value === completed.candidate) {
                  textarea.value = completed.value;
                  if (completed.selection) {
                    textarea.setSelectionRange(completed.selection.start, completed.selection.end);
                  }
                  return;
                }
                if (textarea.value.length > CHRISTMAS_CARD_MESSAGE_MAX_LENGTH) {
                  const selection = previousSelection ?? {
                    start: Math.min(textarea.selectionStart, message.length),
                    end: Math.min(textarea.selectionEnd, message.length),
                  };
                  textarea.value = message;
                  textarea.setSelectionRange(selection.start, selection.end);
                  return;
                }
                updateMessage(textarea, textarea.value);
              }}
              value={compositionDraft ?? message}
            />
            {(compositionDraft ?? message).length === 0 ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center px-1 pt-0 pb-0 text-center text-sm leading-5 text-[#8a8075] sm:px-1.5 sm:pt-3 sm:text-base sm:leading-6 md:text-lg md:leading-7 lg:px-2 lg:pt-4 lg:text-xl lg:leading-8 xl:leading-9 max-[920px]:text-sm max-[920px]:leading-5 [@media(min-width:500px)_and_(max-width:540px)]:!text-[0.84375rem] [@media(min-width:541px)_and_(max-width:711px)]:!text-[0.875rem] [@media(min-width:712px)_and_(max-width:920px)]:!text-[1rem]"
                data-card-message-placeholder
              >
                도파민또에 남기고 싶은 이야기를 180자 안에 담아보세요. 🎄
              </span>
            ) : null}
          </>
        ) : (
          <p className="relative z-10 size-full overflow-hidden whitespace-pre-wrap break-words px-1 py-0 text-center text-sm leading-5 text-[#63322d] sm:px-1.5 sm:text-base sm:leading-6 md:text-lg md:leading-7 lg:px-2 lg:text-xl lg:leading-8 xl:leading-9 max-[920px]:text-sm max-[920px]:leading-5 [@media(min-width:500px)_and_(max-width:540px)]:!text-[0.84375rem] [@media(min-width:541px)_and_(max-width:711px)]:!text-[0.875rem] [@media(min-width:712px)_and_(max-width:920px)]:!text-[1rem]">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
