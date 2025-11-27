import { Message } from "@/features/chat";
import { isSameDay, toDate } from "@/shared/lib/datetime";

export const hasMultipleDates = (messages: Message[]) => {
  if (messages.length <= 1) return false;

  const firstCreatedAt = messages[0].created_at;
  return messages.some((msg) => !isSameDay(firstCreatedAt, msg.created_at));
};

export const isSameUserContinuous = (currentMsg: Message, prevMsg?: Message) => {
  if (!prevMsg || prevMsg.user_id !== currentMsg.user_id) return false;

  const current = toDate(currentMsg.created_at);
  const prev = toDate(prevMsg.created_at);

  return current.getHours() === prev.getHours() && current.getMinutes() === prev.getMinutes();
};
