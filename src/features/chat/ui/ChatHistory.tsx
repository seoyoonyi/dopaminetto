"use client";

interface Message {
  user: string;
  text: string;
}
interface ChatHistoryProps {
  userNickname: string;
  messages: Message[];
}

export default function ChatHistory({ userNickname, messages }: ChatHistoryProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-3 py-2 text-sm font-semibold">채팅</div>
      <div className="flex-1 overflow-y-auto p-3 text-sm flex flex-col">
        <div className="mb-2 text-gray-500">{userNickname} 입장했습니다.</div>
        {/*   TODO: 새 메시지 시 자동 스크롤 구현 */}
        {messages.map((msg, idx) => (
          <div key={`${msg.user}-${idx}`} className="mb-1">
            <span className="font-medium">{msg.user}</span>: {msg.text}
          </div>
        ))}
        <div className="flex-1" />
      </div>
    </div>
  );
}
