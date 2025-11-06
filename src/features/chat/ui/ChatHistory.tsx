"use client";

interface ChatHistoryProps {
  userNickname: string;
}

export default function ChatHistory({ userNickname }: ChatHistoryProps) {
  return (
    <div className="p-6 bg-gray-200 h-screen w-80">
      <h2 className="text-xl mb-4">채팅</h2>

      <p>{userNickname} 입장했습니다.</p>
    </div>
  );
}
