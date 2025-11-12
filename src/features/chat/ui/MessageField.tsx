"use client";

import { ChangeEvent, KeyboardEvent, useRef, useState } from "react";

interface MessageFieldProps {
  channelType: "public" | "private";
  onMessageSend?: (message: string) => void;
}

const ERROR_MESSAGES = {
  PRIVATE_CHANNEL: "프라이빗 채널에서는 메시지를 전송할 수 없습니다.",
  UNKNOWN: "알 수 없는 오류",
} as const;

const PLACEHOLDER_TEXT = "메시지를 입력해 주세요.";

export default function MessageField({ channelType, onMessageSend }: MessageFieldProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isPrivateChannel = channelType === "private";
  const isButtonDisabled = isPrivateChannel || !message.trim();

  const isValidMessage = (trimmed: string) => {
    if (isPrivateChannel) {
      console.warn(ERROR_MESSAGES.PRIVATE_CHANNEL);
      return false;
    }
    return trimmed.length > 0;
  };

  const sendMessage = () => {
    const trimmed = message.trim();

    if (!isValidMessage(trimmed)) {
      return;
    }

    onMessageSend?.(trimmed);
    setMessage("");
    textareaRef.current?.focus();
  };

  const handleEnterKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const updateMessage = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // TODO: UI작업시 auto-grow 기능 추가 예정
  };

  return (
    <div className="border-t p-3 flex gap-2 items-end">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={updateMessage}
        onKeyDown={handleEnterKey}
        placeholder={PLACEHOLDER_TEXT}
        rows={1}
        disabled={isPrivateChannel}
        className="flex-1 p-2 border rounded resize-none disabled:bg-gray-100"
      />
      <button
        onClick={sendMessage}
        disabled={isButtonDisabled}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        전송
      </button>
    </div>
  );
}
