import { ChatMessageSkeleton } from "./ChatMessageSkeleton";

interface ChatMessageSkeletonListProps {
  count?: number;
}

// 자연스러운 채팅 느낌을 위해 메시지 길이 패턴 정의
const VARIANT_PATTERN: Array<"short" | "medium" | "long"> = [
  "medium",
  "short",
  "long",
  "short",
  "medium",
  "short",
  "long",
  "medium",
  "short",
  "medium",
];

export function ChatMessageSkeletonList({ count = 5 }: ChatMessageSkeletonListProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <ChatMessageSkeleton key={i} variant={VARIANT_PATTERN[i % VARIANT_PATTERN.length]} />
      ))}
    </div>
  );
}
