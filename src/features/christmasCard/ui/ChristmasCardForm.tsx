"use client";

import {
  CHRISTMAS_CARD_MESSAGE_MAX_LENGTH,
  CHRISTMAS_CARD_NICKNAME_MAX_LENGTH,
  validateChristmasCardMessage,
} from "@/features/christmasCard/model/christmasCardMessage";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ArrowLeft, List, Send, X } from "lucide-react";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { ChristmasCardFace } from "./ChristmasCardFace";

interface ChristmasCardFormProps {
  nickname: string;
  onSubmit?: (nickname: string, message: string) => Promise<void>;
  onViewList: () => void;
  onBack: () => void;
  onClose: () => void;
  onComplete: () => void;
}

export function ChristmasCardForm({
  nickname: initialNickname,
  onSubmit,
  onViewList,
  onBack,
  onClose,
  onComplete,
}: ChristmasCardFormProps) {
  const [nickname, setNickname] = useState(initialNickname);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const submitLock = useRef(false);
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  const normalizedNickname = nickname.trim();
  const { normalizedMessage, isValid } = validateChristmasCardMessage(message);
  const canSubmit =
    Boolean(onSubmit) &&
    normalizedNickname.length > 0 &&
    normalizedNickname.length <= CHRISTMAS_CARD_NICKNAME_MAX_LENGTH &&
    isValid &&
    !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !onSubmit || submitLock.current) return;

    submitLock.current = true;
    setIsSubmitting(true);
    setError("");
    try {
      await onSubmit(normalizedNickname, normalizedMessage);
      setIsComplete(true);
      if (isMounted.current) onComplete();
    } catch {
      setError("카드를 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <p className="text-center text-sm font-semibold" role="status">
          카드를 남겼어요!
        </p>
        <div className="flex justify-between gap-2">
          <Button
            className="cursor-pointer bg-[#f1c6bd] text-[#63322d] hover:bg-[#e8b2a8]"
            onClick={onViewList}
            type="button"
          >
            <List aria-hidden="true" /> 목록 보기
          </Button>
          <Button className="cursor-pointer" onClick={onClose} type="button" variant="outline">
            <X aria-hidden="true" /> 닫기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="flex w-full flex-col gap-3 p-3" onSubmit={handleSubmit}>
      <ChristmasCardFace
        editable
        inputId="christmas-card-message"
        message={message}
        onMessageChange={setMessage}
      />
      <div className="flex shrink-0 flex-col gap-1">
        <div className="flex items-center gap-1 border-b border-[#c8a88b] px-1 py-1 text-sm text-[#63322d]">
          <label className="shrink-0 font-serif italic" htmlFor="christmas-card-nickname">
            From.
          </label>
          <Input
            autoComplete="off"
            className="h-auto min-w-0 flex-1 border-0 bg-transparent px-1 py-0 text-sm text-[#63322d] shadow-none focus-visible:ring-1 focus-visible:ring-[#a56b48]"
            id="christmas-card-nickname"
            maxLength={CHRISTMAS_CARD_NICKNAME_MAX_LENGTH}
            onChange={(event) => setNickname(event.target.value)}
            value={nickname}
          />
        </div>
        {normalizedNickname.length === 0 ? (
          <p className="text-xs text-destructive">닉네임을 입력해 주세요.</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center justify-between text-xs text-[#63322d]">
        <label className="font-medium" htmlFor="christmas-card-message">
          메시지 개수
        </label>
        <p>
          {message.length} / {CHRISTMAS_CARD_MESSAGE_MAX_LENGTH}
        </p>
      </div>
      {!onSubmit ? (
        <p className="shrink-0 text-xs text-muted-foreground">카드 저장 기능은 준비 중이에요.</p>
      ) : null}
      {error ? (
        <p className="shrink-0 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex shrink-0 justify-between gap-2">
        <Button className="cursor-pointer" onClick={onBack} type="button" variant="outline">
          <ArrowLeft aria-hidden="true" /> 돌아가기
        </Button>
        <Button
          className="cursor-pointer bg-[#f1c6bd] text-[#63322d] hover:bg-[#e8b2a8]"
          disabled={!canSubmit}
          type="submit"
        >
          <Send aria-hidden="true" /> {isSubmitting ? "보내는 중" : "카드 남기기"}
        </Button>
      </div>
    </form>
  );
}
