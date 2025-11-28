"use client";

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

export default function MessageField({
  channelType,
  onMessageSend,
  isConnected,
}: MessageFieldProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
    setMessage(e.target.value);
    if (error) setError(null); // 입력 시 에러 초기화
  };

  return (
    <div className="border-t p-3">
      {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={updateMessage}
          onKeyDown={handleEnterKey}
          placeholder={PLACEHOLDER_TEXT}
          rows={1}
          disabled={isPrivateChannel}
          className={`flex-1 p-2 border rounded resize-none disabled:bg-gray-100 ${
            error ? "border-red-500" : ""
          }`}
        />
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
