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
 * 페이지 목록에 대해 가비지 컬렉션(GC)을 수행하는 순수 함수입니다.
 *
 * 다음 정책에 따라 오래된 페이지를 정리합니다:
 * 1. 최신순으로 MIN_VISIBLE_PAGES 개수는 무조건 보존합니다 (Safe Zone).
 * 2. 전체 페이지 수가 MAX_PAGES 이하이면 원칙적으로 GC를 수행하지 않습니다.
 *    단, 매우 오래된 페이지(SOFT_EXPIRE)가 있으면 최소 1개만 정리합니다.
 * 3. MAX_PAGES를 초과한 경우, 나머지 오래된 페이지(Candidates) 중에서
 *    마지막 접근 시간(lastAccessed)이 가장 오래된 순서대로 LRU 정책으로 제거합니다.
 * 4. 최종적으로 MAX_PAGES 개수를 유지하도록 합니다.
 *
 * 참고:
 * - pages[0]이 가장 최신 페이지입니다. (인덱스가 클수록 과거 데이터)
 * - SOFT_EXPIRE는 protectedTimeMs의 5배로, 극단적으로 오래된 페이지를 정리하는 안전장치입니다.
 */

export const runGarbageCollection = (
  pages: MessagesPage[],
  config: { maxPages: number; minVisiblePages: number; protectedTimeMs: number },
): MessagesPage[] => {
  const { maxPages, minVisiblePages, protectedTimeMs } = config;

  // MAX 이하면 기본적으로 GC 수행 안 함
  if (pages.length <= maxPages) {
    return pages;
  }

  // 설정 오류 방지
  if (minVisiblePages >= maxPages) {
    console.warn("[ChatGC] minVisiblePages가 maxPages보다 크거나 같아 GC를 수행하지 않습니다.");
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
  if (removeCount <= 0) {
    return currentPages;
  }

  // 4. 삭제 후보군(gcCandidates) 중에서 "삭제 가능한(보호되지 않은)" 페이지 식별
  const removableCandidates = gcCandidates
    .map((page, index) => ({
      page,
      originalIndex: minVisiblePages + index,
      timeSinceAccess: now - (page.lastAccessed ?? 0),
    }))
    .filter((candidate) => candidate.timeSinceAccess >= protectedTimeMs);

  // 시간 기반으로 삭제 가능한 페이지가 없으면 종료
  if (removableCandidates.length === 0) {
    return pages;
  }

  // SOFT_EXPIRE 안전장치
  const SOFT_EXPIRE_MS = protectedTimeMs * 5;
  const softExpired = gcCandidates.filter((p) => now - (p.lastAccessed ?? 0) >= SOFT_EXPIRE_MS);

  if (removableCandidates.length === 0 && pages.length <= maxPages && softExpired.length > 0) {
    return pages.filter((p) => p !== softExpired[0]);
  }

  // 5. LRU 정책: 오랫동안 안 본 순서로 정렬
  removableCandidates.sort((a, b) => {
    const timeA = a.page.lastAccessed ?? 0;
    const timeB = b.page.lastAccessed ?? 0;

    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return b.originalIndex - a.originalIndex;
  });

  //  6. 삭제할 인덱스 선정 (최대 removeCount 개수만큼)
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
