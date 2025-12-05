import { Message, MessagesPage } from "@/features/chat";
import { isSameDay, toDate } from "@/shared/lib/datetime";
import { InfiniteData } from "@tanstack/react-query";

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

/**
 * 서버에서 실제 메시지가 도착하면,
 * 동일 유저/내용의 임시 메시지를 제거 (임시 메시지는 id < 0)
 */
export const removeMatchingTempMessage = (prev: Message[], newMessage: Message) => {
  const isTempMessage = (message: Message) => message.id < 0;
  const isSameUser = (message: Message) => message.user_id === newMessage.user_id;
  const isSameContent = (message: Message) => message.message === newMessage.message;

  const tempMessage = prev.find(
    (message) => isTempMessage(message) && isSameUser(message) && isSameContent(message),
  );

  return tempMessage ? prev.filter((message) => message.id !== tempMessage.id) : prev;
};

export const addMessageToCache = (
  oldData: InfiniteData<MessagesPage> | undefined,
  newMessage: Message,
) => {
  if (!oldData) return oldData;

  const isDuplicate = oldData.pages.some((page) =>
    page.messages.some((message) => message.id === newMessage.id),
  );
  if (isDuplicate) return oldData;

  const [firstPage, ...restPages] = oldData.pages;
  const updatedFirstPage = {
    ...firstPage,
    messages: [newMessage, ...firstPage.messages],
  };

  return {
    ...oldData,
    pages: [updatedFirstPage, ...restPages],
  };
};
