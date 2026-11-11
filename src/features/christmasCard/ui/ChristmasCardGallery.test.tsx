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

class ObserverStub {
  constructor(callback: IntersectionObserverCallback | ResizeObserverCallback) {
    void callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  vi.stubGlobal("IntersectionObserver", ObserverStub);
  vi.stubGlobal("ResizeObserver", ObserverStub);
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

  it("첫째 줄 카드 핀이 잘리지 않도록 목록 그리드 위쪽 여백을 둔다", async () => {
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

    expect(container.querySelector("ul")?.className.split(" ")).toContain("pt-1");
    expect(container.querySelector("[data-owned-pin]")?.getAttribute("class")).toContain("-top-1");
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
