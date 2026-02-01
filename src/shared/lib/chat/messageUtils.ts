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

  // 3. GC Candidates에서 제거 대상 선정
  const now = Date.now();
  const currentPages = [...safeZone, ...gcCandidates];

  // 제거해야 할 개수
  const removeCount = currentPages.length - maxPages;
  if (removeCount <= 0) return currentPages;

  // 4. 삭제 후보군(gcCandidates) 중에서 "삭제 가능한(보호되지 않은)" 페이지 식별
  const removableCandidates = gcCandidates
    .map((page, index) => ({
      page,
      originalIndex: minVisiblePages + index, // 원래 배열에서의 인덱스
      timeSinceAccess: now - (page.lastAccessed ?? 0),
    }))
    .filter((candidate) => candidate.timeSinceAccess >= protectedTimeMs); // 보호 시간 지난 것만

  // 5. LRU 정책: 오랫동안 안 본 순서로 정렬 (lastAccessed 오름차순, 값 같으면 원래 인덱스 내림차순(오래된 것 우선?))
  // 주의: 배열 뒤쪽이 '오래된 메시지(과거)'이지만, 'List'상에서는 뒤에 붙음.
  // 하지만 여기서는 '채팅 페이지' 목록임. 0이 최신, N이 과거.
  // 따라서 인덱스가 클수록(뒤에 있을수록) 과거 페이지임.
  // 즉, timestamp가 같으면 index가 큰 것(과거)을 먼저 지워야 함.
  removableCandidates.sort((a, b) => {
    const timeA = a.page.lastAccessed ?? 0;
    const timeB = b.page.lastAccessed ?? 0;
    if (timeA !== timeB) return timeA - timeB;
    // 시간 같으면 인덱스 역순 (큰 인덱스 = 과거 페이지 = 우선 삭제)
    return b.originalIndex - a.originalIndex;
  });

  // 6. 삭제할 인덱스 선정 (최대 removeCount 개수만큼)
  const indicesToRemove = new Set(
    removableCandidates.slice(0, removeCount).map((c) => c.originalIndex),
  );

  // 7. 최종 재구성
  const newPages = currentPages.filter((_, index) => !indicesToRemove.has(index));

  // [Dev] GC Monitoring Log
  if (indicesToRemove.size > 0) {
    const monitoringData = {
      event: "GC_RUN",
      total_pages_before: currentPages.length,
      total_pages_after: newPages.length,
      removed_count: indicesToRemove.size,
      removed_indices: Array.from(indicesToRemove),
      config: { maxPages, minVisiblePages, protectedTimeMs },
      timestamp: new Date().toISOString(),
    };

    console.info(`[ChatGC] Cleared ${indicesToRemove.size} pages.`, monitoringData);
  }

  return newPages;
};
