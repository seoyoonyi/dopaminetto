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
const MIN_CARD_VIEWPORT_WIDTH = 520;

export function measureChristmasCardMessage(
  textarea: HTMLTextAreaElement,
  value: string,
  recoveryValue?: string,
) {
  const manualLineCount = value.split(/\r\n?|\n/).length;
  const rawCharacterLimitExceeded = value.length > CHRISTMAS_CARD_MESSAGE_MAX_LENGTH;
  const manualLineLimitExceeded = manualLineCount > CHRISTMAS_CARD_MESSAGE_MAX_LINES;
  const currentLineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 20;

  const measurement = textarea.cloneNode() as HTMLTextAreaElement;
  measurement.removeAttribute("id");
  measurement.removeAttribute("name");
  measurement.setAttribute("aria-hidden", "true");
  measurement.tabIndex = -1;
  measurement.value = value;
  Object.assign(measurement.style, {
    position: "fixed",
    inset: "0 auto auto 0",
    visibility: "hidden",
    pointerEvents: "none",
    width: getComputedStyle(textarea).width,
    height: `${textarea.clientHeight}px`,
    maxHeight: "none",
  });
  textarea.after(measurement);

  try {
    measurement.value = value;
    const actualHeight = measurement.scrollHeight;
    let actualRecoveryHeight = actualHeight;
    if (recoveryValue !== undefined) {
      measurement.value = recoveryValue;
      actualRecoveryHeight = measurement.scrollHeight;
    }

    Object.assign(measurement.style, {
      height: "0px",
      minHeight: "0px",
      maxHeight: "none",
      paddingBlock: "0px",
      lineHeight: `${currentLineHeight}px`,
    });
    measurement.value = value;
    const actualContentHeight = measurement.scrollHeight;
    const actualLineCount = Math.max(
      manualLineCount,
      value.length === 0 ? 0 : Math.round(actualContentHeight / currentLineHeight),
    );
    let actualRecoveryLineCount = actualLineCount;
    if (recoveryValue !== undefined) {
      measurement.value = recoveryValue;
      actualRecoveryLineCount = Math.max(
        recoveryValue.split(/\r\n?|\n/).length,
        recoveryValue.length === 0 ? 0 : Math.round(measurement.scrollHeight / currentLineHeight),
      );
    }

    const body = textarea.closest<HTMLElement>("[data-card-writing-content]");
    const gutter = body ? body.offsetWidth - body.clientWidth : 0;
    // 현재 뷰포트와 같은 비율로 rem 경계를 환산해 520px에서의 미디어 조건을 확인한다.
    const atReference = (rem: number) =>
      window.matchMedia(`(min-width: ${(rem * window.innerWidth) / MIN_CARD_VIEWPORT_WIDTH}rem)`)
        .matches;
    const isSm = atReference(40);
    const isLg = isSm && atReference(64);
    const shellInsets = isSm ? 7 : 5;
    const panelInsets = isLg ? 2 : isSm ? 1.5 : 0;
    const referenceLineHeight =
      (Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) * 1.25;
    // shortcut: 520px 모달 여백·카드 인셋에 맞춘다. 레이아웃 토큰 변경 시 함께 조정한다.
    Object.assign(measurement.style, {
      width: `calc((${MIN_CARD_VIEWPORT_WIDTH}px - ${shellInsets}rem - 4px - ${gutter}px) * 0.76 - 2px - ${panelInsets}rem)`,
      paddingInline: isLg ? "0.5rem" : isSm ? "0.375rem" : "0.25rem",
      lineHeight: `${referenceLineHeight}px`,
      paddingBlock: "0px",
      height: "0px",
      minHeight: "0px",
      maxHeight: "none",
    });
    // 현재 뷰포트의 반응형 글꼴 클래스보다 520px 기준 글꼴을 우선한다.
    measurement.style.setProperty("font-size", "0.84375rem", "important");
    measurement.value = value;
    const referenceHeight = measurement.scrollHeight;
    const referenceLineCount = Math.max(
      manualLineCount,
      value.length === 0 ? 0 : Math.round(referenceHeight / referenceLineHeight),
    );
    const enforcedLineCount = Math.max(actualLineCount, referenceLineCount);
    const characterCount = value.length;
    const enforcedCharacterCount = value.length;
    let recoveryEnforcedLineCount = enforcedLineCount;
    if (recoveryValue !== undefined) {
      measurement.value = recoveryValue;
      const referenceRecoveryHeight = measurement.scrollHeight;
      const referenceRecoveryLineCount = Math.max(
        recoveryValue.split(/\r\n?|\n/).length,
        recoveryValue.length === 0 ? 0 : Math.round(referenceRecoveryHeight / referenceLineHeight),
      );
      recoveryEnforcedLineCount = Math.max(actualRecoveryLineCount, referenceRecoveryLineCount);
    }
    const recoveryEnforcedCharacterCount = recoveryValue?.length ?? enforcedCharacterCount;
    const currentActualOverflow = actualHeight > textarea.clientHeight;
    const currentReferenceOverflow = referenceLineCount > CHRISTMAS_CARD_MESSAGE_MAX_LINES;
    const exceedsLineLimit =
      manualLineLimitExceeded ||
      currentActualOverflow ||
      currentReferenceOverflow ||
      enforcedLineCount > CHRISTMAS_CARD_MESSAGE_MAX_LINES;
    const exceedsCharacterLimit =
      rawCharacterLimitExceeded || enforcedCharacterCount > CHRISTMAS_CARD_MESSAGE_MAX_LENGTH;
    const layoutOverflow = exceedsLineLimit || exceedsCharacterLimit;
    const isRecovering = recoveryValue !== undefined && value.length < recoveryValue.length;
    const worsensOverflow =
      actualHeight > actualRecoveryHeight ||
      enforcedLineCount > recoveryEnforcedLineCount ||
      enforcedCharacterCount > recoveryEnforcedCharacterCount;

    return {
      characterCount,
      lineCount: actualLineCount,
      exceedsLimits:
        rawCharacterLimitExceeded ||
        manualLineLimitExceeded ||
        (layoutOverflow && !(isRecovering && !worsensOverflow)),
      exceedsCharacterLimit,
      exceedsLineLimit,
    };
  } finally {
    measurement.remove();
  }
}

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
  onMessageCountChange?: (count: number, lineCount: number, exceedsLimits: boolean) => void;
  onLimitFeedbackChange?: (reason: "characters" | "lines" | "paste" | null) => void;
  onComposingChange?: (isComposing: boolean) => void;
}

export function ChristmasCardFace({
  message,
  editable = false,
  inputId,
  className,
  onMessageChange,
  onMessageCountChange,
  onLimitFeedbackChange,
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

  function updateMessage(
    textarea: HTMLTextAreaElement,
    nextValue: string,
    metrics: ReturnType<typeof measureChristmasCardMessage>,
  ) {
    const normalizedValue = nextValue
      .slice(0, CHRISTMAS_CARD_MESSAGE_MAX_LENGTH)
      .replace(/[\uD800-\uDBFF]$/, "");
    if (textarea.value !== normalizedValue) textarea.value = normalizedValue;
    onMessageChange?.(normalizedValue);
    onMessageCountChange?.(metrics.characterCount, metrics.lineCount, metrics.exceedsLimits);
    onLimitFeedbackChange?.(null);
    return normalizedValue;
  }

  function finishComposition(textarea: HTMLTextAreaElement) {
    const previous = composition.current;
    if (!previous) return;
    const candidate = textarea.value;
    const metrics = measureChristmasCardMessage(textarea, candidate);
    const value = metrics.exceedsLimits
      ? previous.value
      : updateMessage(textarea, candidate, metrics);
    if (metrics.exceedsLimits) {
      const previousMetrics = measureChristmasCardMessage(textarea, previous.value);
      onMessageCountChange?.(
        previousMetrics.characterCount,
        previousMetrics.lineCount,
        previousMetrics.exceedsLimits,
      );
      onLimitFeedbackChange?.(metrics.exceedsLineLimit ? "lines" : "characters");
    }
    textarea.value = value;
    if (value !== candidate) textarea.setSelectionRange(previous.start, previous.end);
    completedComposition.current = {
      candidate,
      value,
      selection: value !== candidate ? previous : null,
    };
    composition.current = null;
    setCompositionDraft(null);
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
              className="relative z-10 h-full w-full max-h-[calc(var(--card-message-lines)*1lh)] min-h-0 field-sizing-fixed resize-none overflow-hidden rounded-none border-0 bg-transparent px-1 py-0 text-center text-sm leading-5 text-[#63322d] shadow-none placeholder:text-center focus-visible:border-0 focus-visible:ring-0 sm:px-1.5 sm:py-0 sm:text-base sm:leading-6 md:text-lg md:leading-7 lg:px-2 lg:py-0 lg:text-xl lg:leading-8 xl:leading-9 max-[920px]:text-sm max-[920px]:leading-5 max-[501px]:!text-[0.8125rem] [@media(min-width:501px)_and_(max-width:540px)]:!text-[0.84375rem] [@media(min-width:541px)_and_(max-width:711px)]:!text-[0.875rem] [@media(min-width:712px)_and_(max-width:920px)]:!text-[1rem]"
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
                const metrics = measureChristmasCardMessage(textarea, textarea.value);
                onMessageCountChange?.(
                  metrics.characterCount,
                  metrics.lineCount,
                  metrics.exceedsLimits,
                );
                onComposingChange?.(true);
              }}
              onKeyDown={(event) => {
                if (
                  composition.current ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.altKey ||
                  (event.key.length !== 1 && !["Enter", "Backspace", "Delete"].includes(event.key))
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
                let acceptedText = pastedText
                  .slice(0, insertableLength)
                  .replace(/[\uD800-\uDBFF]$/, "");
                let candidate = `${textarea.value.slice(0, start)}${acceptedText}${suffix}`;
                let metrics = measureChristmasCardMessage(textarea, candidate);
                if (metrics.exceedsLimits) {
                  const rejectedForLines = metrics.exceedsLineLimit;
                  let low = 0;
                  let high = acceptedText.length;
                  while (low < high) {
                    const middle = Math.ceil((low + high) / 2);
                    const prefix = acceptedText.slice(0, middle).replace(/[\uD800-\uDBFF]$/, "");
                    const trial = `${textarea.value.slice(0, start)}${prefix}${suffix}`;
                    if (measureChristmasCardMessage(textarea, trial).exceedsLimits) {
                      high = middle - 1;
                    } else {
                      low = middle;
                    }
                  }
                  acceptedText = acceptedText.slice(0, low).replace(/[\uD800-\uDBFF]$/, "");
                  candidate = `${textarea.value.slice(0, start)}${acceptedText}${suffix}`;
                  metrics = measureChristmasCardMessage(textarea, candidate);
                  if (
                    metrics.exceedsLimits ||
                    (pastedText.length > 0 && acceptedText.length === 0)
                  ) {
                    onLimitFeedbackChange?.(rejectedForLines ? "lines" : "characters");
                    return;
                  }
                }
                const wasTruncated = acceptedText.length < pastedText.length;
                const value = updateMessage(textarea, candidate, metrics);
                textarea.setSelectionRange(
                  start + acceptedText.length,
                  Math.min(start + acceptedText.length, value.length),
                );
                if (wasTruncated) onLimitFeedbackChange?.("paste");
              }}
              onChange={(event) => {
                const textarea = event.currentTarget;
                const previousSelection = selectionBeforeInput.current;
                selectionBeforeInput.current = null;
                if (composition.current) {
                  setCompositionDraft(textarea.value);
                  const metrics = measureChristmasCardMessage(textarea, textarea.value);
                  onMessageCountChange?.(
                    metrics.characterCount,
                    metrics.lineCount,
                    metrics.exceedsLimits,
                  );
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
                const metrics = measureChristmasCardMessage(textarea, textarea.value, message);
                if (metrics.exceedsLimits) {
                  const selection = previousSelection ?? {
                    start: Math.min(textarea.selectionStart, message.length),
                    end: Math.min(textarea.selectionEnd, message.length),
                  };
                  textarea.value = message;
                  textarea.setSelectionRange(selection.start, selection.end);
                  onLimitFeedbackChange?.(metrics.exceedsLineLimit ? "lines" : "characters");
                  return;
                }
                updateMessage(textarea, textarea.value, metrics);
              }}
              onScroll={(event) => {
                const textarea = event.currentTarget;
                // 조합 중 캐럿을 따라 8행으로 밀려도 메시지 상자는 스크롤하지 않는다.
                if (textarea.scrollTop !== 0) textarea.scrollTop = 0;
              }}
              value={compositionDraft ?? message}
            />
            {(compositionDraft ?? message).length === 0 ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center px-1 pt-0 pb-0 text-center text-sm leading-5 text-[#8a8075] sm:px-1.5 sm:pt-3 sm:text-base sm:leading-6 md:text-lg md:leading-7 lg:px-2 lg:pt-4 lg:text-xl lg:leading-8 xl:leading-9 max-[920px]:text-sm max-[920px]:leading-5 max-[501px]:!text-[0.8125rem] [@media(min-width:501px)_and_(max-width:540px)]:!text-[0.84375rem] [@media(min-width:541px)_and_(max-width:711px)]:!text-[0.875rem] [@media(min-width:712px)_and_(max-width:920px)]:!text-[1rem]"
                data-card-message-placeholder
              >
                도파민또에 남기고 싶은 이야기를 180자 안에 담아보세요. 🎄
              </span>
            ) : null}
          </>
        ) : (
          <p className="relative z-10 size-full overflow-hidden whitespace-pre-wrap break-words px-1 py-0 text-center text-sm leading-5 text-[#63322d] sm:px-1.5 sm:text-base sm:leading-6 md:text-lg md:leading-7 lg:px-2 lg:text-xl lg:leading-8 xl:leading-9 max-[920px]:text-sm max-[920px]:leading-5 max-[501px]:!text-[0.8125rem] [@media(min-width:501px)_and_(max-width:540px)]:!text-[0.84375rem] [@media(min-width:541px)_and_(max-width:711px)]:!text-[0.875rem] [@media(min-width:712px)_and_(max-width:920px)]:!text-[1rem]">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
