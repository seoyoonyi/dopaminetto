// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";

import { ChristmasCardGallery } from "./ChristmasCardGallery";

const mockUseChristmasCardsQuery = vi.hoisted(() => vi.fn());
vi.mock("../hooks/useChristmasCardsQuery", () => ({
  useChristmasCardsQuery: mockUseChristmasCardsQuery,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  targets = new Set<Element>();

  constructor(private callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this);
  }

  observe(target: Element) {
    this.targets.add(target);
  }

  unobserve() {}
  disconnect() {}

  notify() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

class IntersectionObserverStub {
  constructor(callback: IntersectionObserverCallback) {
    void callback;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  ResizeObserverStub.instances = [];
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.unstubAllGlobals();
});

describe("ChristmasCardGallery", () => {
  it("내 카드에 키보드 포커스하면 소유 설명 툴팁을 표시한다", async () => {
    mockUseChristmasCardsQuery.mockReturnValue({
      data: {
        cards: [
          {
            id: 1,
            created_at: "2026-11-12",
            nickname: "QA_나1",
            content: "내 카드",
            event_type: "christmas",
            user_id: "user-1",
          },
          {
            id: 2,
            created_at: "2026-11-12",
            nickname: "QA_나1",
            content: "다른 사람 카드",
            event_type: "christmas",
            user_id: "user-2",
          },
        ],
        totalCount: 2,
      },
      isError: false,
      isPending: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () =>
      root!.render(
        <ChristmasCardGallery
          userId="user-1"
          onLoadCards={async () => ({ cards: [], totalCount: 2 })}
          onPageChange={vi.fn()}
          onSelect={vi.fn()}
          page={1}
        />,
      ),
    );
    expect(container.querySelectorAll('[data-owned-card="true"]')).toHaveLength(1);
    const ownedCard = container.querySelector<HTMLButtonElement>('[data-owned-card="true"]');
    expect(ownedCard?.querySelector("svg")).toBeTruthy();
    expect(ownedCard?.getAttribute("aria-label")).toBe("QA_나1님의 카드 보기, 내가 작성한 카드");

    await act(async () => {
      ownedCard?.focus();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain(
      "내가 작성한 카드",
    );
  });

  it("내 카드의 일반 영역을 호버할 때는 소유 설명 툴팁을 표시하지 않는다", async () => {
    mockUseChristmasCardsQuery.mockReturnValue({
      data: {
        cards: [
          {
            id: 1,
            created_at: "2026-11-12",
            nickname: "QA_나1",
            content: "내 카드",
            event_type: "christmas",
            user_id: "user-1",
          },
        ],
        totalCount: 1,
      },
      isError: false,
      isPending: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () =>
      root!.render(
        <ChristmasCardGallery
          userId="user-1"
          onLoadCards={async () => ({ cards: [], totalCount: 1 })}
          onPageChange={vi.fn()}
          onSelect={vi.fn()}
          page={1}
        />,
      ),
    );

    const cardText = container.querySelector('[data-owned-card="true"] span');
    const pointerMove = new Event("pointermove", { bubbles: true });
    Object.defineProperty(pointerMove, "pointerType", { value: "mouse" });

    await act(async () => {
      cardText?.dispatchEvent(pointerMove);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.body.querySelector('[data-slot="tooltip-content"]')).toBeNull();

    const pin = container.querySelector("[data-owned-pin]");
    const pinPointerMove = new Event("pointermove", { bubbles: true });
    Object.defineProperty(pinPointerMove, "pointerType", { value: "mouse" });

    await act(async () => {
      pin?.dispatchEvent(pinPointerMove);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.body.querySelector('[data-slot="tooltip-content"]')?.textContent).toContain(
      "내가 작성한 카드",
    );
  });

  it("첫째 줄 핀과 스크롤바에 필요한 목록 그리드 여백을 둔다", async () => {
    mockUseChristmasCardsQuery.mockReturnValue({
      data: {
        cards: [
          {
            id: 1,
            created_at: "2026-11-12",
            nickname: "QA_나1",
            content: "내 카드",
            event_type: "christmas",
            user_id: "user-1",
          },
        ],
        totalCount: 1,
      },
      isError: false,
      isPending: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () =>
      root!.render(
        <ChristmasCardGallery
          userId="user-1"
          onLoadCards={async () => ({ cards: [], totalCount: 1 })}
          onPageChange={vi.fn()}
          onSelect={vi.fn()}
          page={1}
        />,
      ),
    );

    expect(container.querySelector("ul")?.className.split(" ")).toEqual(
      expect.arrayContaining(["pt-1", "pl-1"]),
    );
    expect(container.querySelector("ul")?.className).not.toContain("pr-2");
    expect(container.querySelector("[data-owned-pin]")?.getAttribute("class")).toContain("-top-1");
    const messageArea = container.querySelector<HTMLElement>("[data-owned-card] > span");
    const clampedMessage = messageArea?.querySelector<HTMLElement>("span");
    expect(messageArea?.className).toContain("flex-1");
    expect(clampedMessage?.className).toContain("line-clamp-7");
    expect(clampedMessage?.className).not.toContain("flex-1");
    expect(clampedMessage?.className).toContain("text-base");
    expect(clampedMessage?.className).toContain("sm:text-sm");
    expect(clampedMessage?.className).toContain("lg:text-base");
  });

  it("목록에 세로 스크롤이 생길 때만 오른쪽 여백을 적용한다", async () => {
    mockUseChristmasCardsQuery.mockReturnValue({
      data: {
        cards: [
          {
            id: 1,
            created_at: "2026-11-12",
            nickname: "QA_나1",
            content: "내 카드",
            event_type: "christmas",
            user_id: "user-1",
          },
        ],
        totalCount: 1,
      },
      isError: false,
      isPending: false,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () =>
      root!.render(
        <ChristmasCardGallery
          onLoadCards={async () => ({ cards: [], totalCount: 1 })}
          onPageChange={vi.fn()}
          onSelect={vi.fn()}
          page={1}
        />,
      ),
    );

    const scrollViewport = container.querySelector<HTMLElement>('[data-slot="carousel-content"]')!;
    Object.defineProperties(scrollViewport, {
      clientHeight: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 500 },
    });

    await act(async () => {
      ResizeObserverStub.instances
        .filter((observer) => observer.targets.has(scrollViewport))
        .forEach((observer) => observer.notify());
    });

    expect(container.querySelector("ul")?.className).toContain("pr-2");
  });

  it("현재 페이지에만 스켈레톤 여섯 장을 표시한다", async () => {
    mockUseChristmasCardsQuery.mockReturnValue({
      data: undefined,
      isError: false,
      isPending: true,
      isPlaceholderData: false,
      refetch: vi.fn(),
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () =>
      root!.render(
        <ChristmasCardGallery
          onLoadCards={async () => ({ cards: [], totalCount: 12 })}
          onPageChange={vi.fn()}
          onSelect={vi.fn()}
          page={2}
        />,
      ),
    );

    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(container.querySelectorAll('[role="status"] li')).toHaveLength(6);
    expect(
      container.querySelector('[data-slot="carousel-item"][aria-label="1페이지"]')
        ?.childElementCount,
    ).toBe(0);
  });
});
