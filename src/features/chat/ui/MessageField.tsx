"use client";

import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/shared/hooks";
import { Textarea } from "@/shared/ui/textarea";

import { ChangeEvent, KeyboardEvent, useRef, useState } from "react";

interface MessageFieldProps {
  channelType: "public" | "private";
  onMessageSend?: (message: string) => Promise<{ error?: string }>;
  isConnected: boolean;
}

const ERROR_MESSAGES = {
  PRIVATE_CHANNEL: "프라이빗 채널에서는 메시지를 전송할 수 없습니다.",
  SEND_FAILED: "메시지 전송에 실패했습니다. 다시 시도해주세요.",
  UNKNOWN: "알 수 없는 오류",
} as const;

const PLACEHOLDER_TEXT = "메시지를 입력해 주세요.";
const MAX_LENGTH = 1000;
const WRAPPER_PADDING = 24;

export default function MessageField({
  channelType,
  onMessageSend,
  isConnected,
}: MessageFieldProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 글자수 상태
  const charCount = message.length;
  // 900자 이상일 때 UI 표시 (1000자의 90%)
  const isNearLimit = charCount >= 900;
  const isAtLimit = charCount >= MAX_LENGTH;

  const { textareaRef, wrapperRef, isScrollable } = useAutoResizeTextarea(message, {
    maxHeight: isNearLimit ? 128 : 96,
    minHeight: 48,
  });

  const isPrivateChannel = channelType === "private";
  const isButtonDisabled = isPrivateChannel || !message.trim() || !isConnected;

  const isValidMessage = (trimmed: string) => {
    if (isPrivateChannel) {
      console.warn(ERROR_MESSAGES.PRIVATE_CHANNEL);
      return false;
    }
    if (!isConnected) {
      console.warn("메시지 전송 시도: 채널이 연결되지 않았습니다.");
      return false;
    }
    return trimmed.length > 0;
  };

  const sendMessage = async () => {
    const trimmed = message.trim();

    if (!isValidMessage(trimmed)) {
      return;
    }

    setError(null);
    setMessage("");

    const result = await onMessageSend?.(trimmed);

    if (result?.error) {
      setError(ERROR_MESSAGES.SEND_FAILED);
      setMessage(trimmed);
    }

    textareaRef.current?.focus();
  };

  const handleEnterKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  const updateMessage = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;

    if (newValue.length > MAX_LENGTH) {
      setMessage(newValue.slice(0, MAX_LENGTH));
    } else {
      setMessage(newValue);
    }

    if (error) setError(null); // 입력 시 에러 초기화
  };

  return (
    <div className="border-t p-3">
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <div className="flex gap-2 items-end">
        {/* wrapper에 padding을 부여 - WRAPPER_PADDING(24px)과 py-3(12px) * 2 */}
        <div
          ref={wrapperRef}
          className={cn(
            "flex-1 relative flex flex-col min-h-[48px] overflow-hidden rounded-md border transition-all duration-200",
            error ? "border-red-500" : "border-input",
          )}
          style={{
            paddingTop: `${WRAPPER_PADDING / 2}px`,
            paddingBottom: isNearLimit ? "6px" : `${WRAPPER_PADDING / 2}px`,
          }}
        >
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={updateMessage}
            onKeyDown={handleEnterKey}
            placeholder={PLACEHOLDER_TEXT}
            rows={1}
            disabled={isPrivateChannel}
            className={cn(
              "w-full h-full min-h-0 leading-6 resize-none border-0 shadow-none py-0 px-3 outline-none",
              "focus-visible:ring-0 focus-visible:ring-offset-0 disabled:bg-gray-100",
              isScrollable ? "overflow-y-auto" : "overflow-y-hidden",
            )}
          />

          {/* 글자수 카운터: 900자 이상일 때만 Textarea 내부에 표시 */}
          {isNearLimit && (
            <div
              className={cn(
                "self-end mr-6 py-0.5 rounded text-xs transition-all duration-200",
                "bg-background/80 backdrop-blur-sm select-none",
                isAtLimit ? "text-red-500 font-medium" : "text-amber-500 font-medium",
              )}
            >
              <span>
                {charCount} / {MAX_LENGTH}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={sendMessage}
          disabled={isButtonDisabled}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          전송
        </button>
      </div>
    </div>
  );
}
