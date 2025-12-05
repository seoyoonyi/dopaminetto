interface ChatMessageSkeletonProps {
  variant?: "short" | "medium" | "long";
}

export function ChatMessageSkeleton({ variant = "medium" }: ChatMessageSkeletonProps) {
  const renderContent = () => {
    switch (variant) {
      case "short":
        return <div className="h-4 w-1/3 rounded bg-gray-200" />;
      case "long":
        return (
          <div className="space-y-1.5">
            <div className="h-4 w-full rounded bg-gray-200" />
            <div className="h-4 w-4/5 rounded bg-gray-200" />
            <div className="h-4 w-3/5 rounded bg-gray-200" />
          </div>
        );
      default:
        return (
          <div className="space-y-1.5">
            <div className="h-4 w-4/5 rounded bg-gray-200" />
            <div className="h-4 w-2/5 rounded bg-gray-200" />
          </div>
        );
    }
  };

  return (
    <div className="flex animate-pulse gap-3 py-1">
      {/* 프로필 이미지 */}
      <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200" />

      <div className="flex-1 space-y-2">
        {/* 닉네임 + 시간 */}
        <div className="flex items-center gap-2">
          <div className="h-4 w-20 rounded bg-gray-200" />
          <div className="h-3 w-16 rounded bg-gray-100" />
        </div>

        {/* 메시지 내용 */}
        {renderContent()}
      </div>
    </div>
  );
}
