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
 * 하이브리드 GC 정책 (시간 기반 + 개수 기반):
 * 1. 최신순으로 MIN_VISIBLE_PAGES 개수는 무조건 보존합니다 (Safe Zone).
 * 2. Safe Zone 이후의 페이지(Candidates) 중 PROTECTED_TIME_MS를 초과한 페이지만 삭제 대상이 됩니다.
 * 3. 삭제 대상 중에서 마지막 접근 시간(lastAccessed)이 가장 오래된 순서대로 LRU 정책으로 제거합니다.
 * 4. 삭제 개수는 다음 두 조건 중 더 많은 쪽을 따릅니다:
 *    - 시간 기반: 보호 시간을 초과한 페이지가 있으면 최소 1개 이상 삭제
 *    - 개수 기반: 전체 페이지 수가 MAX_PAGES를 초과하면 초과분만큼 삭제
 *
 * 예시:
 * - 페이지 5개, MAX=10, 보호시간 초과 페이지 2개 → 2개 삭제 (시간 기반)
 * - 페이지 15개, MAX=10, 보호시간 초과 페이지 3개 → 5개 삭제 (개수 기반)
 * - 페이지 5개, MAX=10, 보호시간 초과 페이지 0개 → 삭제 없음
 *
 * 참고:
 * - pages[0]이 가장 최신 페이지입니다. (인덱스가 클수록 과거 데이터)
 * - 보호 시간 내의 페이지는 MAX_PAGES를 초과해도 삭제되지 않습니다.
 */

export const runGarbageCollection = (
  pages: MessagesPage[],
  config: { maxPages: number; minVisiblePages: number; protectedTimeMs: number },
): MessagesPage[] => {
  const { maxPages, minVisiblePages, protectedTimeMs } = config;

  // 설정 오류 방지
  if (minVisiblePages >= maxPages) {
    console.warn("[ChatGC] minVisiblePages가 maxPages보다 크거나 같아 GC를 수행하지 않습니다.");
    return pages;
  }

  // 1. Safe Zone (최신 페이지들) - 항상 보존
  const safeZone = pages.slice(0, minVisiblePages);

  // 2. GC Candidates (검사 대상 페이지들)
  const gcCandidates = pages.slice(minVisiblePages);

  // 3. 시간 기반 필터링: protectedTimeMs 초과한 페이지 식별
  const now = Date.now();

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

  // 4. LRU 정책: 오랫동안 안 본 순서로 정렬
  removableCandidates.sort((a, b) => {
    const timeA = a.page.lastAccessed ?? 0;
    const timeB = b.page.lastAccessed ?? 0;

    if (timeA !== timeB) {
      return timeA - timeB;
    }
    // 시간 같으면 인덱스 역순 (큰 인덱스 = 과거 페이지 = 우선 삭제)
    return b.originalIndex - a.originalIndex;
  });

  // 5. 삭제할 개수 계산 const currentTotalPages = pages.length;
  const currentTotalPages = pages.length;
  const removeCountBySize = Math.max(0, currentTotalPages - maxPages); // 개수 기반 삭제
  const removeCountByTime = removableCandidates.length; // 시간 기반 삭제 가능 개수

  // 두 조건 중 더 많이 삭제해야 하는 쪽 선택
  // 단, removableCandidates 범위 내에서만 삭제
  const removeCount = Math.min(
    Math.max(removeCountBySize, 1), // 최소 1개는 삭제 (시간 초과 페이지가 있다면)
    removeCountByTime,
  );

  // 6. 삭제할 인덱스 선정
  const indicesToRemove = new Set(
    removableCandidates.slice(0, removeCount).map((c) => c.originalIndex),
  );

  // 7. 최종 재구성
  const newPages = pages.filter((_, index) => !indicesToRemove.has(index));

  // [Dev] GC Monitoring Log
  if (indicesToRemove.size > 0) {
    const monitoringData = {
      event: "GC_RUN",
      total_pages_before: currentTotalPages,
      total_pages_after: newPages.length,
      removed_count: indicesToRemove.size,
      removed_indices: Array.from(indicesToRemove),
      trigger: removeCountBySize > 0 ? "SIZE_BASED" : "TIME_BASED",
      config: { maxPages, minVisiblePages, protectedTimeMs },
      timestamp: new Date().toISOString(),
    };

    console.info(`[ChatGC] Cleared ${indicesToRemove.size} pages.`, monitoringData);
  }

  return newPages;
};
