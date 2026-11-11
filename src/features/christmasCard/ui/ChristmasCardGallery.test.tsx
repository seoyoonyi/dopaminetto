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
