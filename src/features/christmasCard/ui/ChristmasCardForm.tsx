"use client";

import { validateChristmasCardMessage } from "@/features/christmasCard/model/christmasCardMessage";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { ArrowLeft, Send } from "lucide-react";

import { useRef, useState } from "react";
import type { FormEvent } from "react";

const NICKNAME_MAX_LENGTH = 12;

interface ChristmasCardFormProps {
  nickname: string;
  onSubmit?: (nickname: string, message: string) => Promise<void>;
  onBack: () => void;
}

export function ChristmasCardForm({
  nickname: initialNickname,
  onSubmit,
  onBack,
}: ChristmasCardFormProps) {
  const [nickname, setNickname] = useState(initialNickname);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const submitLock = useRef(false);
  const normalizedNickname = nickname.trim();
  const { normalizedMessage, isValid } = validateChristmasCardMessage(message);
  const canSubmit =
    Boolean(onSubmit) &&
    normalizedNickname.length > 0 &&
    normalizedNickname.length <= NICKNAME_MAX_LENGTH &&
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
        <article className="rounded-md border border-[#e6d3b4] bg-[#fff8ed] p-3 text-sm">
          <p className="mb-1 font-semibold">{normalizedNickname}</p>
          <p className="whitespace-pre-wrap break-words">{normalizedMessage}</p>
        </article>
        <div className="flex justify-between gap-2">
          <Button className="cursor-pointer" onClick={onBack} type="button" variant="outline">
            <ArrowLeft aria-hidden="true" /> 돌아가기
          </Button>
          <Button
            className="cursor-pointer bg-[#f1c6bd] text-[#63322d] hover:bg-[#e8b2a8]"
            onClick={() => {
              setNickname(initialNickname);
              setMessage("");
              setIsComplete(false);
            }}
            type="button"
          >
            다시 작성하기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-3 p-3" onSubmit={handleSubmit}>
      <div
        data-card-template="true"
        className="rounded-md border border-[#e6d3b4] bg-[#fff8ed] p-2 text-center text-sm"
      >
        🎄 메리 크리스마스
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor="christmas-card-nickname">
          닉네임
        </label>
        <Input
          autoComplete="off"
          id="christmas-card-nickname"
          maxLength={NICKNAME_MAX_LENGTH}
          onChange={(event) => setNickname(event.target.value)}
          value={nickname}
        />
        {normalizedNickname.length === 0 ? (
          <p className="text-xs text-destructive">닉네임을 입력해 주세요.</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium" htmlFor="christmas-card-message">
          메시지
        </label>
        <Textarea
          id="christmas-card-message"
          maxLength={150}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="따뜻한 메시지를 남겨주세요."
          rows={4}
          value={message}
        />
        <p className="text-right text-xs text-muted-foreground">{message.length} / 150</p>
      </div>
      {!onSubmit ? (
        <p className="text-xs text-muted-foreground">카드 저장 기능은 준비 중이에요.</p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-between gap-2">
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
