"use client";

import { cn } from "@/lib/utils";
import { getCharacterConfig } from "@/shared/constants";
import { CONNECTION_STATUS_LABEL, type ConnectionStatus } from "@/shared/lib";
import { useNicknameDialogStore } from "@/shared/store/useNicknameDialogStore";
import { useUserStore } from "@/shared/store/useUserStore";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { type FormEvent, useEffect, useRef, useState } from "react";

import Image from "next/image";

import { useChangeNickname } from "../hooks/useChangeNickname";
import { NICKNAME_MAX_LENGTH, isValidNickname } from "../model/nickname";

interface NicknameChangeButtonProps {
  townConnectionStatus: ConnectionStatus;
}

export function NicknameChangeButton({ townConnectionStatus }: NicknameChangeButtonProps) {
  const nickname = useUserStore((state) => state.userNickname);
  const characterId = useUserStore((state) => state.selectedCharacterId);
  const character = getCharacterConfig(characterId);
  const isOpen = useNicknameDialogStore((state) => state.isOpen);
  const setOpen = useNicknameDialogStore((state) => state.setOpen);
  const connectionLabel = CONNECTION_STATUS_LABEL[townConnectionStatus];

  useEffect(() => {
    setOpen(false);
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setOpen(false);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      setOpen(false);
    };
  }, [setOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <div className="flex h-12 min-w-0 max-w-full items-center gap-2 px-3 sm:max-w-64">
        <span className="relative size-9 shrink-0 overflow-hidden rounded-full border border-gray-200">
          <Image
            src={`/assets/images/characters/previews/${character.id}-still.png`}
            alt=""
            width={character.previewImageWidth}
            height={character.previewImageHeight}
            className={cn(
              "absolute -top-2 left-1/2 h-auto max-w-none -translate-x-1/2 p-[10%] [image-rendering:pixelated]",
              character.id === "p-girl" ? "ml-1.5 w-14" : "w-11",
            )}
            unoptimized
          />
        </span>
        <div className="flex min-w-0 flex-col items-start text-left">
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-5 min-w-0 max-w-full cursor-pointer gap-1.5 rounded-sm p-0 text-[15px] leading-5 font-medium hover:bg-transparent hover:text-current active:opacity-90 has-[>svg]:px-0 dark:hover:bg-transparent"
              aria-label={`${nickname}, 닉네임 변경`}
            >
              <span className="truncate">{nickname}</span>
              <Pencil className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            </Button>
          </DialogTrigger>
          <span
            role="status"
            aria-label={`타운 ${connectionLabel}`}
            className="flex items-center gap-1.5 text-[13px] leading-4 font-normal text-muted-foreground"
          >
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                townConnectionStatus === "connected"
                  ? "bg-emerald-500"
                  : townConnectionStatus === "connecting"
                    ? "bg-amber-400"
                    : "bg-red-500",
              )}
              aria-hidden
            />
            {connectionLabel}
          </span>
        </div>
      </div>
      {isOpen ? <NicknameChangeForm nickname={nickname} onClose={() => setOpen(false)} /> : null}
    </Dialog>
  );
}

interface NicknameChangeFormProps {
  nickname: string;
  onClose: () => void;
}

function NicknameChangeForm({ nickname, onClose }: NicknameChangeFormProps) {
  const [draft, setDraft] = useState(nickname);
  const submitting = useRef(false);
  const { mutateAsync, isPending, isError, reset } = useChangeNickname();
  const isValid = isValidNickname(draft);
  const canSave = isValid && draft !== nickname && !isPending;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave || submitting.current) return;
    submitting.current = true;
    try {
      await mutateAsync(draft);
      toast.success("닉네임이 변경되었어요.");
      onClose();
    } catch {
      // mutation의 오류 상태로 입력값을 유지하며 재시도를 안내한다.
    } finally {
      submitting.current = false;
    }
  };

  return (
    <DialogContent
      className="sm:max-w-sm"
      showCloseButton={!isPending}
      onEscapeKeyDown={(event) => {
        if (submitting.current) event.preventDefault();
      }}
      onInteractOutside={(event) => {
        if (submitting.current) event.preventDefault();
      }}
    >
      <DialogHeader>
        <DialogTitle>닉네임 변경</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isPending}>
        <div className="space-y-2">
          <div className="relative">
            <Input
              id="town-nickname"
              value={draft}
              maxLength={NICKNAME_MAX_LENGTH}
              disabled={isPending}
              onChange={(event) => {
                setDraft(event.target.value);
                reset();
              }}
              onFocus={(event) => event.target.select()}
              aria-describedby="town-nickname-hint"
              aria-invalid={!isValid}
              className="pr-16"
            />
            <span
              id="town-nickname-hint"
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground tabular-nums"
            >
              {draft.length}/{NICKNAME_MAX_LENGTH}
            </span>
          </div>
          {isError ? (
            <p role="alert" className="text-sm text-destructive">
              닉네임을 저장하지 못했어요. 다시 시도해주세요.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
            취소
          </Button>
          <Button type="submit" disabled={!canSave}>
            {isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
