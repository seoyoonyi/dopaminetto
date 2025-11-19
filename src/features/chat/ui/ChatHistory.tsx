"use client";

import { useTownPresenceView } from "@/features/presence/model/useTownPresence";
import { hasMultipleDates, isSameDay } from "@/shared/lib";

import { useEffect, useRef, useState } from "react";

import { Message, SystemMessage } from "../types";
import { ChatMessageItem } from "./ChatMessageItem";
import { DateDivider } from "./DateDivider";
import { SystemMessageItem } from "./SystemMessageItem";

interface ChatHistoryProps {
  messages: Message[];
  currentUserNickname: string;
}

type TimelineItem = { type: "message"; data: Message } | { type: "system"; data: SystemMessage };

export default function ChatHistory({ messages, currentUserNickname }: ChatHistoryProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { participants } = useTownPresenceView();

  const trackedParticipantsRef = useRef<Set<string> | null>(null);
  const isInitialPresenceSyncRef = useRef(true);

  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);

  useEffect(() => {
    const currentNicknames = participants.map((p) => p.nickname);
    const currentSet = new Set(currentNicknames);
    const trackedSet = trackedParticipantsRef.current;

    if (isInitialPresenceSyncRef.current) {
      if (!currentNicknames.includes(currentUserNickname)) {
        return;
      }

      isInitialPresenceSyncRef.current = false;
      trackedParticipantsRef.current = new Set(currentSet);

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSystemMessages((prev) => [
        ...prev,
        {
          id: `join-${currentUserNickname}-${Date.now()}`,
          type: "join",
          nickname: currentUserNickname,
          timestamp: new Date().toISOString(),
        },
      ]);

      return;
    }

    if (!trackedSet) {
      trackedParticipantsRef.current = new Set(currentSet);
      return;
    }

    const newJoins: string[] = [];
    const leaves: string[] = [];

    currentSet.forEach((nickname) => {
      if (!trackedSet.has(nickname)) {
        newJoins.push(nickname);
        trackedSet.add(nickname);
      }
    });

    trackedSet.forEach((nickname) => {
      if (!currentSet.has(nickname)) {
        leaves.push(nickname);
        trackedSet.delete(nickname);
      }
    });

    if (newJoins.length === 0 && leaves.length === 0) {
      return;
    }

    setSystemMessages((prev) => [
      ...prev,
      ...newJoins.map<SystemMessage>((nickname) => ({
        id: `join-${nickname}-${Date.now()}`,
        type: "join",
        nickname,
        timestamp: new Date().toISOString(),
      })),
      ...leaves.map<SystemMessage>((nickname) => ({
        id: `leave-${nickname}-${Date.now()}`,
        type: "leave",
        nickname,
        timestamp: new Date().toISOString(),
      })),
    ]);
  }, [participants, currentUserNickname]);

  const shouldShowDateDividers = hasMultipleDates(messages);

  const mergedItems: TimelineItem[] = [
    ...messages.map<TimelineItem>((msg) => ({ type: "message", data: msg })),
    ...systemMessages.map<TimelineItem>((sys) => ({ type: "system", data: sys })),
  ];

  const allItems = mergedItems.sort(
    (a, b) => new Date(a.data.timestamp).getTime() - new Date(b.data.timestamp).getTime(),
  );

  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;

    const AUTO_SCROLL_THRESHOLD_PX = 80;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;

    const isNearBottom = distanceToBottom < AUTO_SCROLL_THRESHOLD_PX;

    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, systemMessages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-3 py-2 text-sm font-semibold">채팅</div>

      <div className="flex flex-col flex-1 overflow-y-auto p-3 text-sm">
        {allItems.map((item, index) => {
          const prevItem = index > 0 ? allItems[index - 1] : undefined;

          const showDateDivider =
            shouldShowDateDividers &&
            (index === 0 || (prevItem && !isSameDay(prevItem.data.timestamp, item.data.timestamp)));

          const prevMsg = prevItem?.type === "message" ? (prevItem.data as Message) : undefined;

          return (
            <div key={`${item.type}-${item.data.timestamp}-${index}`}>
              {showDateDivider && <DateDivider timestamp={item.data.timestamp} />}

              {item.type === "system" ? (
                <SystemMessageItem message={item.data as SystemMessage} />
              ) : (
                <ChatMessageItem message={item.data as Message} previousMessage={prevMsg} />
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
