import { Message } from "@/features/chat";
import { isSameDay, toDate } from "@/shared/lib/datetime";

export const hasMultipleDates = (messages: Message[]) => {
  if (messages.length <= 1) return false;

  const firstTimestamp = messages[0].timestamp;
  return messages.some((msg) => !isSameDay(firstTimestamp, msg.timestamp));
};

export const isSameUserContinuous = (currentMsg: Message, prevMsg?: Message) => {
  if (!prevMsg || prevMsg.user !== currentMsg.user) return false;

  const current = toDate(currentMsg.timestamp);
  const prev = toDate(prevMsg.timestamp);

  return current.getHours() === prev.getHours() && current.getMinutes() === prev.getMinutes();
};
