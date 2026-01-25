import { Message, MessagesPage } from "@/features/chat";
import { CHAT_GC_CONFIG } from "@/shared/config";
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
    lastAccessed: Date.now(),
  };

  let newPages = [updatedFirstPage, ...restPages];

  // GC 실행 (Feature Flag 확인)
  if (CHAT_GC_CONFIG.ENABLED) {
    newPages = runGarbageCollection(newPages, {
      maxPages: CHAT_GC_CONFIG.MAX_PAGES,
      minVisiblePages: CHAT_GC_CONFIG.MIN_VISIBLE_PAGES,
      protectedTimeMs: CHAT_GC_CONFIG.PROTECTED_TIME_MS,
    });
  }

  return {
    ...oldData,
    pages: newPages,
  };
};

/**
 * 페이지의 lastAccessed 타임스탬프를 현재 시간으로 갱신합니다.
 */
export const updatePageTimestamp = (page: MessagesPage): MessagesPage => {
  return {
    ...page,
    lastAccessed: Date.now(),
  };
};

/**
 * [Pure Function] 페이지 목록에 대해 Garbage Collection을 수행합니다.
 *
 * 정책:
 * 1. MAX_PAGES 이하이면 그대로 반환
 * 2. 최신순 MIN_VISIBLE_PAGES 개수는 무조건 보존 (Safe Zone)
 * 3. 나머지(오래된 페이지) 중에서 lastAccessed가 가장 예전인 순서대로 제거
 * 4. 제거 후 MAX_PAGES 개수 유지
 *
 * 참고: pages[0]이 최신 페이지라고 가정합니다. (Dopaminetto 구조 상 reverse로 렌더링되지만 데이터 구조상 0이 최신)
 */
export const runGarbageCollection = (
  pages: MessagesPage[],
  config: { maxPages: number; minVisiblePages: number; protectedTimeMs: number },
): MessagesPage[] => {
  const { maxPages, minVisiblePages, protectedTimeMs } = config;

  if (pages.length <= maxPages) {
    return pages;
  }

  // 1. Safe Zone (최신 페이지들) - 0 ~ minVisiblePages-1 인덱스
  const safeZone = pages.slice(0, minVisiblePages);

  // 2. GC Candidates (오래된 페이지들) - minVisiblePages ~ 끝
  const gcCandidates = pages.slice(minVisiblePages);

  // 3. GC Candidates에서만 제거 수행
  const now = Date.now();

  // 뒤에서부터 검사 (가장 오래된 페이지부터)
  while (safeZone.length + gcCandidates.length > maxPages && gcCandidates.length > 0) {
    const lastPage = gcCandidates[gcCandidates.length - 1];
    const timeSinceAccess = now - (lastPage.lastAccessed ?? 0);

    // 보호 조건 체크: protectedTimeMs 이내 접근 기록 있으면 보호
    if (timeSinceAccess < protectedTimeMs) {
      // 마지막 페이지를 보고 있는 중임. 더 이상 자르지 않고 종료.
      break;
    }

    // 자름
    gcCandidates.pop();
  }

  return [...safeZone, ...gcCandidates];
};
