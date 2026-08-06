/**
 * 메시지 유틸리티 테스트 (Vitest)
 */
import { Message, MessagesPage } from "@/features/chat";
import { InfiniteData } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  addMessageToCache,
  hasMultipleDates,
  isSameUserContinuous,
  removeMatchingTempMessage,
  runGarbageCollection,
  updatePageTimestamp,
} from "./messageUtils";

// Mock Config to bypass Supabase client initialization error
vi.mock("@/shared/config", () => ({
  CHAT_GC_CONFIG: {
    ENABLED: true,
    MAX_PAGES: 50,
    MIN_VISIBLE_PAGES: 10,
    PROTECTED_TIME_MS: 1000,
  },
}));

const createMockPage = (id: number, lastAccessed?: number): MessagesPage => ({
  messages: [],
  nextCursor: String(id),
  lastAccessed,
});

const TEST_CONFIG = {
  maxPages: 5,
  minVisiblePages: 2,
  protectedTimeMs: 60 * 1000,
};

describe("Chat Message Utils - GC Logic", () => {
  it("MAX_PAGES 이하일 때는 아무것도 삭제하지 않는다 (모두 최근 페이지)", () => {
    // 모두 방금 접근한 것으로 생성 -> 시간 기반 삭제 트리거 안됨
    const pages = Array.from({ length: 4 }, (_, i) => createMockPage(i, Date.now()));
    const result = runGarbageCollection(pages, TEST_CONFIG);
    expect(result.length).toBe(4);
  });

  it("MAX_PAGES 이하일 때는 보호 시간이 지나도 삭제하지 않는다 (현재 구현 동작)", () => {
    // 0, 1: 최근 (보호됨)
    // 2, 3: 오래됨 (삭제 대상이지만 MAX_PAGES 이하이므로 보존)
    const pages = Array.from({ length: 4 }, (_, i) => {
      if (i >= 2) return createMockPage(i, 0); // 오래됨
      return createMockPage(i, Date.now());
    });

    const result = runGarbageCollection(pages, TEST_CONFIG);

    // 현재 구현에서는 MAX_PAGES 이하이면 바로 리턴하므로 삭제되지 않음
    expect(result.length).toBe(4);
  });

  it("MAX_PAGES 초과 시 오래된 페이지(뒤쪽)를 삭제한다", () => {
    const pages = Array.from({ length: 10 }, (_, i) => createMockPage(i, 0));
    const result = runGarbageCollection(pages, TEST_CONFIG);

    expect(result.length).toBe(5);
    // 최신(0) 보존
    expect(result[0].nextCursor).toBe("0");
    // 5개 남았으면 0,1,2,3,4
    expect(result[4].nextCursor).toBe("4");
  });

  it("보호된 페이지(최근 접근)는 삭제하지 않는다", () => {
    const pages = Array.from({ length: 10 }, (_, i) => createMockPage(i, 0));

    // 마지막 페이지(가장 과거)를 방금 봤다고 가정
    const lastIndex = 9;
    pages[lastIndex].lastAccessed = Date.now();

    const result = runGarbageCollection(pages, TEST_CONFIG);

    // 기대: 뒤(9번)가 보호되더라도, 중간에 있는(2~8) 안쓰는 페이지는 삭제되어야 함.
    // MAX_PAGES(5개)를 맞추기 위해 5개 삭제.
    expect(result.length).toBe(5);
    // 9번은 최근 접근했으므로 반드시 보존
    expect(result[result.length - 1].nextCursor).toBe("9");
  });

  it("중간까지만 자르고 보호된 페이지 만나면 멈춘다 (Mixed Scenario)", () => {
    const pages = Array.from({ length: 10 }, (_, i) => createMockPage(i, 0));
    // 9(오래됨), 8(오래됨) -> 삭제 가능
    // 7(최근) -> 보호
    pages[7].lastAccessed = Date.now();

    const result = runGarbageCollection(pages, TEST_CONFIG);

    // 기대: 9, 8 삭제됨. 7 보호됨. 하지만 그 앞의 2,3,4 도 삭제되어야 함(MAX 맞추기 위해).
    // 최종 5개 남음.
    expect(result.length).toBe(5);
    // 7번 인덱스(보호됨)는 살아있어야 함.
    const hasProtected = result.some((p) => p.nextCursor === "7");
    expect(hasProtected).toBe(true);
  });

  it("[Infinite Scroll] 이미 꽉 찼을 때, 과거 페이지를 로딩하면 '중간의 오래된 페이지'가 삭제된다", () => {
    // 5개가 꽉 참 (0, 1, 2, 3, 4)
    const pages = Array.from({ length: 5 }, (_, i) =>
      createMockPage(i, Date.now() - 1000 * 60 * 60),
    ); // 1시간 전

    // 무한 스크롤로 더 과거 페이지(5)가 끝에 추가됨 (React Query Infinite 구조상)
    // 구조: [0(최신), 1, 2, 3, 4, 5(가장 과거-방금 로딩)]
    // 단, 5번은 방금 로딩했으므로 lastAccessed는 최신임!
    const loadedPage = createMockPage(5, Date.now());
    const newPages = [...pages, loadedPage]; // Length 6

    const result = runGarbageCollection(newPages, TEST_CONFIG);

    // 기대:
    // - 방금 로딩한 5번은 중요하므로(방금 봄) 삭제되면 안됨.
    // - MAX_PAGES(5개)는 지켜져야 함.
    // - SafeZone(0, 1) + Protected(5) = 필수 보존
    // - Candidates(2, 3, 4) 중 하나가 삭제되어야 함. (오래된 순)

    const hasLoadedPage = result.some((p) => p.nextCursor === "5");
    expect(hasLoadedPage).toBe(true);

    // MAX_PAGES 지켜짐
    expect(result.length).toBe(5);
  });

  it("minVisiblePages >= maxPages 설정 오류 시 페이지를 삭제하지 않는다", () => {
    const wrongConfig = { ...TEST_CONFIG, minVisiblePages: 10, maxPages: 5 };
    const pages = Array.from({ length: 10 }, (_, i) => createMockPage(i, 0));

    // Console warn mock
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = runGarbageCollection(pages, wrongConfig);

    expect(result.length).toBe(10);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("모든 gcCandidates가 보호 시간(protectedTimeMs) 내에 있으면 삭제하지 않는다", () => {
    // 0, 1은 SafeZone
    // 2, 3, 4, 5, 6, 7 ... 은 Candidates
    // maxPages=5.
    const pages = Array.from({ length: 8 }, (_, i) => createMockPage(i, Date.now())); // 모두 방금 접근

    const result = runGarbageCollection(pages, TEST_CONFIG);

    // 모두 보호되므로 삭제되지 않아야 함 (MAX_PAGES를 초과하더라도 중요 페이지는 보존)
    // * 정책 결정: ProtectedTimeMs는 강력한 보호인가? -> 코드 상 filter로 인해 removableCandidates가 비게 됨 -> 삭제 안함.
    expect(result.length).toBe(8);
  });

  it("삭제해야 할 개수(removeCount)보다 삭제 가능한 후보(removable)가 적으면, 가능한 만큼만 삭제한다", () => {
    // Max=5, MinVisible=2.
    // Pages=10. RemoveCount=5.
    // Safe: 0, 1
    // Candidates: 2~9.
    // 이 중 2,3,4만 오래됨(삭제가능). 5,6,7,8,9는 최근(보호).
    // 기대: 2,3,4만 삭제되고 5,6,7,8,9는 남음.
    // 결과 Length: Safe(2) + Protected(5) = 7. (10 -> 7로 감소)

    const pages = Array.from({ length: 10 }, (_, i) => {
      if (i >= 2 && i <= 4) return createMockPage(i, 0); // 오래됨
      return createMockPage(i, Date.now()); // 최근
    });

    const result = runGarbageCollection(pages, TEST_CONFIG);

    expect(result.length).toBe(7);

    // 삭제된 것 확인 (2,3,4 가 없어야 함)
    const remainingIds = result.map((p) => p.nextCursor);
    expect(remainingIds).not.toContain("2");
    expect(remainingIds).not.toContain("3");
    expect(remainingIds).not.toContain("4");
    expect(remainingIds).toContain("5");
  });
});

describe("Chat Message Utils - Helpers", () => {
  describe("hasMultipleDates", () => {
    it("메시지가 없거나 1개면 false 반환", () => {
      expect(hasMultipleDates([])).toBe(false);
      const msg = { created_at: "2024-01-01T10:00:00" } as Message;
      expect(hasMultipleDates([msg])).toBe(false);
    });

    it("같은 날짜의 메시지들이면 false 반환", () => {
      const messages = [
        { created_at: "2024-01-01T10:00:00" },
        { created_at: "2024-01-01T15:00:00" },
      ] as Message[];
      expect(hasMultipleDates(messages)).toBe(false);
    });

    it("다른 날짜가 섞여있으면 true 반환", () => {
      const messages = [
        { created_at: "2024-01-01T23:59:59" },
        { created_at: "2024-01-02T00:00:01" },
      ] as Message[];
      expect(hasMultipleDates(messages)).toBe(true);
    });
  });

  describe("isSameUserContinuous", () => {
    const user1 = "user1";
    const user2 = "user2";
    const time = "2024-01-01T10:00:00";
    const timeSameMinute = "2024-01-01T10:00:59";
    const timeDiffMinute = "2024-01-01T10:01:00";

    it("이전 메시지가 없거나 다른 유저면 false", () => {
      const current = { user_id: user1, created_at: time } as Message;
      expect(isSameUserContinuous(current, undefined)).toBe(false);
      expect(isSameUserContinuous(current, { user_id: user2, created_at: time } as Message)).toBe(
        false,
      );
    });

    it("같은 유저여도 분(minute)이 다르면 false", () => {
      const current = { user_id: user1, created_at: timeDiffMinute } as Message;
      const prev = { user_id: user1, created_at: time } as Message;
      expect(isSameUserContinuous(current, prev)).toBe(false);
    });

    it("같은 유저이고 분(minute)이 같으면 true", () => {
      const current = { user_id: user1, created_at: timeSameMinute } as Message;
      const prev = { user_id: user1, created_at: time } as Message;
      expect(isSameUserContinuous(current, prev)).toBe(true);
    });
  });

  describe("removeMatchingTempMessage", () => {
    const realMsg = { id: 100, user_id: "u1", message: "hello" } as Message;

    it("매칭되는 임시 메시지가 있으면 제거한다", () => {
      const tempMsg = { id: -1, user_id: "u1", message: "hello" } as Message;
      const otherMsg = { id: 50, user_id: "u2", message: "hi" } as Message;
      const prev = [otherMsg, tempMsg];

      const result = removeMatchingTempMessage(prev, realMsg);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(50);
    });

    it("매칭되는 임시 메시지가 없으면 원본 배열 반환", () => {
      const prev = [{ id: 50, user_id: "u2", message: "hi" } as Message];
      const result = removeMatchingTempMessage(prev, realMsg);
      expect(result).toBe(prev);
      expect(result).toHaveLength(1);
    });
  });

  describe("addMessageToCache", () => {
    const mockPage = (messages: Message[]): MessagesPage => ({
      messages,
      nextCursor: "next",
      lastAccessed: 0,
    });

    it("oldData가 없으면 undefined 반환", () => {
      expect(addMessageToCache(undefined, {} as Message)).toBeUndefined();
    });

    it("중복 메시지면 oldData 그대로 반환", () => {
      const msg = { id: 1 } as Message;
      const oldData = {
        pages: [mockPage([msg])],
        pageParams: [],
      } as unknown as InfiniteData<MessagesPage>;
      expect(addMessageToCache(oldData, msg)).toBe(oldData);
    });

    it("새로운 메시지를 첫 페이지 맨 앞에 추가하고 lastAccessed 갱신", () => {
      const existingMsg = { id: 1 } as Message;
      const newMsg = { id: 2 } as Message;
      const oldData = {
        pages: [mockPage([existingMsg])],
        pageParams: [],
      } as unknown as InfiniteData<MessagesPage>;

      const result = addMessageToCache(oldData, newMsg);

      expect(result).not.toBe(oldData);
      expect(result?.pages[0].messages).toHaveLength(2);
      expect(result?.pages[0].messages[0]).toBe(newMsg);
      expect(result?.pages[0].lastAccessed).toBeGreaterThan(0);
    });
  });

  describe("updatePageTimestamp", () => {
    it("lastAccessed를 현재 시간으로 갱신", () => {
      const page = { lastAccessed: 0 } as MessagesPage;
      const result = updatePageTimestamp(page);
      expect(result.lastAccessed).toBeGreaterThan(0);
      expect(result).not.toBe(page);
    });
  });
});
