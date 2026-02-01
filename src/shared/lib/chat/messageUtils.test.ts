/**
 * 메세지 유틸리티 테스트 (Vitest)
 */
import { MessagesPage } from "@/features/chat";
import { describe, expect, it, vi } from "vitest";

import { runGarbageCollection } from "./messageUtils";

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
  it("MAX_PAGES 이하일 때는 아무것도 삭제하지 않는다", () => {
    const pages = Array.from({ length: 4 }, (_, i) => createMockPage(i));
    const result = runGarbageCollection(pages, TEST_CONFIG);
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
    const pages = Array.from({ length: 5 }, (_, i) => createMockPage(i, 0));

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
});
