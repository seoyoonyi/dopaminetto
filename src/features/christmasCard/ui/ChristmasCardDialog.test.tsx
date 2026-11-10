// @vitest-environment jsdom
import { useGuestbookDialogStore } from "@/shared/store/useGuestbookDialogStore";
import { ChristmasGuestbook } from "@/widgets/christmasGuestbook";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { useRef, useState } from "react";
import { type Root, createRoot } from "react-dom/client";

import type { ChristmasCard } from "../model/christmasCard";
import { ChristmasCardDialog } from "./ChristmasCardDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockUseUserInfo = vi.hoisted(() => vi.fn());
const mockLoadCards = vi.hoisted(() => vi.fn());
const originalResizeObserver = globalThis.ResizeObserver;

vi.mock("@/shared/hooks/useUserInfo", () => ({ useUserInfo: mockUseUserInfo }));
vi.mock("@/shared/config/supabase.client", () => ({ supabase: {} }));
vi.mock("../api/fetchChristmasCards", () => ({ fetchChristmasCards: mockLoadCards }));

class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  targets: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this);
  }

  observe(target: Element) {
    this.targets.push(target);
  }

  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }

  notify() {
    this.callback([], this as unknown as ResizeObserver);
  }
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let boundary: HTMLDivElement | null = null;
let boundaryPosition = { left: 40, top: 20 };

beforeEach(() => {
  mockLoadCards.mockResolvedValue({ cards: [], totalCount: 0 });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??= ResizeObserverStub as unknown as typeof IntersectionObserver;
  boundaryPosition = { left: 40, top: 20 };
  useGuestbookDialogStore.setState({ isOpen: false, position: null });
  mockUseUserInfo.mockReturnValue({
    data: { user_metadata: { nickname: "테스트 사용자" } },
    isLoading: false,
  });
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  boundary = null;
  ResizeObserverStub.instances = [];
  globalThis.ResizeObserver = originalResizeObserver;
  useGuestbookDialogStore.setState({ isOpen: false, position: null });
});

async function render() {
  container = document.createElement("div");
  boundary = document.createElement("div");
  Object.defineProperty(boundary, "getBoundingClientRect", {
    value: () => ({
      left: boundaryPosition.left,
      top: boundaryPosition.top,
      right: boundaryPosition.left + boundary!.clientWidth,
      bottom: boundaryPosition.top + boundary!.clientHeight,
      width: boundary!.clientWidth,
      height: boundary!.clientHeight,
    }),
  });
  Object.defineProperties(boundary, {
    clientLeft: { configurable: true, value: 0 },
    clientTop: { configurable: true, value: 0 },
    clientWidth: { configurable: true, value: 400 },
    clientHeight: { configurable: true, value: 240 },
  });
  container.appendChild(boundary);
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root!.render(
      <QueryClientProvider client={new QueryClient()}>
        <ChristmasGuestbook gameAreaRef={{ current: boundary }} />
      </QueryClientProvider>,
    ),
  );
}

function DialogHarness({
  onSubmit,
}: {
  onSubmit: (nickname: string, message: string) => Promise<void | ChristmasCard>;
}) {
  const [open, setOpen] = useState(true);
  const boundaryRef = useRef<HTMLDivElement>(null);
  return (
    <QueryClientProvider client={new QueryClient()}>
      <div ref={boundaryRef}>
        <button onClick={() => setOpen(true)} type="button">
          다시 열기
        </button>
        <ChristmasCardDialog
          boundaryRef={boundaryRef}
          nickname="눈사람"
          onOpenChange={setOpen}
          onSubmit={onSubmit}
          open={open}
          position={null}
        />
      </div>
    </QueryClientProvider>
  );
}

function dialog() {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

describe("ChristmasGuestbook", () => {
  it("첫 클릭 후 게임 영역이 준비되면 다시 클릭하지 않아도 메뉴를 표시한다", async () => {
    await render();
    Object.defineProperties(boundary, {
      clientWidth: { configurable: true, value: 0 },
      clientHeight: { configurable: true, value: 0 },
    });

    act(() => useGuestbookDialogStore.getState().setOpen(true, { x: 100, y: 100 }));
    const menu = dialog()!;
    Object.defineProperty(menu, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, right: 192, bottom: 128, width: 192, height: 128 }),
    });
    expect(menu.style.visibility).toBe("hidden");
    expect(menu.className).toContain("!animate-none");

    Object.defineProperties(boundary, {
      clientWidth: { configurable: true, value: 400 },
      clientHeight: { configurable: true, value: 240 },
    });
    await act(async () => {
      ResizeObserverStub.instances.forEach((observer) => observer.notify());
    });

    expect(menu.style.visibility).toBe("visible");
    expect(menu.className).not.toContain("!animate-none");
    expect(menu.style.left).toBe("48px");
    expect(menu.style.top).toBe("36px");

    await act(async () =>
      dialog()!.querySelector<HTMLButtonElement>("[data-slot='dialog-close']")!.click(),
    );

    expect(ResizeObserverStub.instances.every((observer) => observer.disconnected)).toBe(true);
  });

  it("선택 메뉴 전체가 게임 영역 경계 안에 배치된다", async () => {
    await render();
    act(() => useGuestbookDialogStore.getState().setOpen(true, { x: 42, y: 25 }));
    const menu = dialog()!;
    Object.defineProperty(menu, "getBoundingClientRect", {
      value: () => ({ left: 48, top: 28, right: 240, bottom: 156, width: 192, height: 128 }),
    });

    act(() => useGuestbookDialogStore.getState().setOpen(true, { x: 43, y: 26 }));

    expect(menu.style.left).toBe("48px");
    expect(menu.style.top).toBe("28px");
    expect(menu.style.maxWidth).toBe("384px");
    expect(menu.style.maxHeight).toBe("224px");

    act(() => useGuestbookDialogStore.getState().setOpen(true));

    expect(menu.style.left).toBe("144px");
    expect(menu.style.top).toBe("76px");
  });

  it("게임 영역이 리사이즈되면 열린 메뉴를 새 경계 안으로 다시 배치한다", async () => {
    await render();
    act(() => useGuestbookDialogStore.getState().setOpen(true, { x: 430, y: 230 }));
    const menu = dialog()!;
    Object.defineProperties(menu, {
      offsetWidth: { configurable: true, value: 192 },
      offsetHeight: { configurable: true, value: 128 },
    });

    await act(async () => {
      ResizeObserverStub.instances.forEach((observer) => observer.notify());
    });

    expect(menu.style.left).toBe("240px");
    expect(menu.style.top).toBe("124px");

    Object.defineProperties(boundary, {
      clientWidth: { configurable: true, value: 300 },
      clientHeight: { configurable: true, value: 180 },
    });
    await act(async () => {
      ResizeObserverStub.instances.forEach((observer) => observer.notify());
    });

    expect(menu.style.left).toBe("140px");
    expect(menu.style.top).toBe("64px");
    expect(menu.style.maxWidth).toBe("284px");
    expect(menu.style.maxHeight).toBe("164px");
  });

  it("메뉴가 게임 영역보다 크면 크기를 제한하고 음수 좌표를 만들지 않는다", async () => {
    await render();
    Object.defineProperties(boundary, {
      clientWidth: { configurable: true, value: 120 },
      clientHeight: { configurable: true, value: 80 },
    });
    act(() => useGuestbookDialogStore.getState().setOpen(true, { x: 430, y: 230 }));
    const menu = dialog()!;
    Object.defineProperties(menu, {
      offsetWidth: { configurable: true, value: 192 },
      offsetHeight: { configurable: true, value: 128 },
    });

    await act(async () => {
      ResizeObserverStub.instances.forEach((observer) => observer.notify());
    });

    expect(menu.style.maxWidth).toBe("104px");
    expect(menu.style.maxHeight).toBe("64px");
    expect(Number.parseFloat(menu.style.left)).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(menu.style.top)).toBeGreaterThanOrEqual(0);
  });

  it("브라우저 리사이즈로 게임 영역 위치만 바뀌어도 메뉴를 다시 배치한다", async () => {
    await render();
    act(() => useGuestbookDialogStore.getState().setOpen(true, { x: 430, y: 230 }));
    const menu = dialog()!;
    Object.defineProperties(menu, {
      offsetWidth: { configurable: true, value: 192 },
      offsetHeight: { configurable: true, value: 128 },
    });
    await act(async () => {
      ResizeObserverStub.instances.forEach((observer) => observer.notify());
    });
    expect(menu.style.left).toBe("240px");
    expect(menu.style.top).toBe("124px");

    boundaryPosition = { left: 200, top: 100 };
    await act(async () => window.dispatchEvent(new Event("resize")));

    expect(menu.style.left).toBe("334px");
    expect(menu.style.top).toBe("166px");
  });

  it("스크롤로 게임 영역 위치만 바뀌어도 메뉴를 다시 배치한다", async () => {
    await render();
    act(() => useGuestbookDialogStore.getState().setOpen(true, { x: 430, y: 230 }));
    const menu = dialog()!;
    Object.defineProperties(menu, {
      offsetWidth: { configurable: true, value: 192 },
      offsetHeight: { configurable: true, value: 128 },
    });
    await act(async () => {
      ResizeObserverStub.instances.forEach((observer) => observer.notify());
    });
    expect(menu.style.left).toBe("240px");
    expect(menu.style.top).toBe("124px");

    boundaryPosition = { left: 200, top: 100 };
    await act(async () => window.dispatchEvent(new Event("scroll")));

    expect(menu.style.left).toBe("334px");
    expect(menu.style.top).toBe("166px");
  });

  it("메뉴를 닫으면 위치 재측정 이벤트 리스너를 정리한다", async () => {
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    await render();
    act(() => useGuestbookDialogStore.getState().setOpen(true, { x: 430, y: 230 }));
    act(() => useGuestbookDialogStore.getState().setOpen(false));

    expect(removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith("scroll", expect.any(Function), true);
  });

  it("트리 클릭 위치에 오버레이 없이 작은 선택 메뉴를 표시한다", async () => {
    await render();
    expect(dialog()).toBeNull();

    act(() => useGuestbookDialogStore.getState().setOpen(true, { x: 500, y: 300 }));
    const menu = dialog()!;
    Object.defineProperties(menu, {
      offsetWidth: { value: 192 },
      offsetHeight: { value: 128 },
    });
    act(() => useGuestbookDialogStore.getState().setOpen(true, { x: 501, y: 301 }));

    expect(dialog()?.textContent).toContain("크리스마스 카드");
    expect(dialog()?.querySelector("img")).toBeNull();
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
    expect(document.body.style.pointerEvents).not.toBe("none");
    expect(dialog()?.className).toContain("bg-[var(--winter-town-canvas-background)]");
    expect(dialog()?.className).toContain("p-0");
    expect(dialog()?.className).toContain("w-48");
    expect(dialog()?.className).toContain("z-40");
    expect(dialog()?.className).toContain("origin-center");
    expect(dialog()?.className).toContain("transition-none");
    expect(dialog()?.className).toContain("[--tw-enter-translate-x:0]");
    expect(dialog()?.className).toContain("[--tw-enter-translate-y:0.5rem]");
    expect(dialog()?.className).not.toContain("slide-in-from-right");
    expect(dialog()?.querySelector('[data-slot="dialog-header"]')?.className).toContain(
      "bg-[#b8ccda]",
    );
    expect(dialog()?.querySelector('[data-slot="dialog-title"]')?.className).toContain(
      "font-display",
    );
    expect(
      dialog()?.querySelector('[data-slot="dialog-title"] svg')?.getAttribute("class"),
    ).toContain("fill-emerald-600");
    expect(dialog()?.querySelector('[data-slot="dialog-footer"]')?.className).toContain(
      "sm:flex-col",
    );
    expect(
      Array.from(dialog()?.querySelectorAll("button") ?? [])
        .slice(0, 2)
        .every((button) => button.className.includes("w-full")),
    ).toBe(true);
    expect(dialog()?.style.left).toBe("240px");
    expect(dialog()?.style.top).toBe("124px");
    const writeButton = dialog()?.querySelector<HTMLButtonElement>("button[data-primary='true']");
    expect(writeButton?.textContent).toContain("작성하기");
    expect(writeButton?.className).toContain("bg-[#f1c6bd]");
    expect(writeButton?.className).toContain("cursor-pointer");
  });

  it("목록 보기는 전체 화면에서 저장된 카드 목록을 열고 상세 보기로 이동한다", async () => {
    await render();
    mockLoadCards.mockResolvedValueOnce({
      cards: [
        {
          id: 1,
          created_at: "2026-11-10T00:00:00.000Z",
          nickname: "눈사람",
          content: "따뜻한 겨울 보내세요!",
          event_type: "christmas",
          user_id: "user-1",
        },
      ],
      totalCount: 1,
    });
    act(() => useGuestbookDialogStore.getState().setOpen(true));

    const listButton = Array.from(dialog()!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("목록 보기"),
    );

    expect(listButton?.disabled).toBe(false);
    await act(async () => listButton?.click());

    expect(dialog()?.className).toContain("!w-screen");
    const overlay = document.querySelector<HTMLElement>('[data-slot="dialog-overlay"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.className).toContain("bg-black/50");
    expect(dialog()?.className).toContain("!bg-transparent");
    expect(dialog()?.querySelector("section")?.className).toContain("max-w-6xl");
    expect(dialog()?.textContent).toContain("1 / 1");
    expect(dialog()?.textContent).toContain("돌아가기");
    await vi.waitFor(() =>
      expect(dialog()?.querySelector('button[aria-label="눈사람님의 카드 보기"]')).not.toBeNull(),
    );
    const cardButton = dialog()?.querySelector<HTMLButtonElement>(
      'button[aria-label="눈사람님의 카드 보기"]',
    );
    expect(cardButton?.textContent).toContain("따뜻한 겨울 보내세요!");

    await act(async () => cardButton?.click());
    expect(dialog()?.textContent).toContain("카드 상세 보기");
    expect(dialog()?.textContent).toContain("From. 눈사람");
    expect(dialog()?.textContent).toContain("따뜻한 겨울 보내세요!");
    const detailButton = Array.from(dialog()!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("목록으로"),
    );
    expect(detailButton?.parentElement?.className).toContain("justify-between");
    expect(detailButton?.parentElement?.querySelector("time")?.dateTime).toBe(
      "2026-11-10T00:00:00.000Z",
    );
    await act(async () => detailButton?.click());
    expect(dialog()?.textContent).toContain("1 / 1");

    const backButton = Array.from(dialog()!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("돌아가기"),
    );
    await act(async () => backButton?.click());
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
    expect(dialog()?.textContent).toContain("목록 보기");

    const reopenListButton = Array.from(dialog()!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("목록 보기"),
    );
    await act(async () => reopenListButton?.click());
    await act(async () => {
      document
        .querySelector<HTMLElement>('[data-slot="dialog-overlay"]')
        ?.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    expect(useGuestbookDialogStore.getState().isOpen).toBe(false);
  });

  it("닫기 동작은 공유 열림 상태도 초기화한다", async () => {
    await render();
    act(() => useGuestbookDialogStore.getState().setOpen(true, { x: 500, y: 300 }));
    const closeButton = dialog()!.querySelector<HTMLButtonElement>(
      "button[data-slot='dialog-close']",
    );

    await act(async () => closeButton?.click());

    expect(useGuestbookDialogStore.getState().isOpen).toBe(false);
    expect(useGuestbookDialogStore.getState().position).toBeNull();
  });

  it("작성하기는 실제 저장 폼으로 전환하고 Escape는 팝업을 닫는다", async () => {
    await render();
    act(() => useGuestbookDialogStore.getState().setOpen(true));
    const writeButton = Array.from(dialog()!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("작성하기"),
    );

    await act(async () => writeButton?.click());
    expect(dialog()?.className).toContain("!w-screen");
    expect(document.querySelector('[data-slot="dialog-overlay"]')?.className).toContain(
      "bg-black/50",
    );
    expect(dialog()?.className).toContain("!bg-transparent");
    expect(dialog()?.querySelector("section")?.className).toContain("max-w-6xl");
    expect(dialog()?.querySelector("section")?.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(dialog()?.querySelector("section")?.className).toContain("overflow-y-auto");
    expect(dialog()?.querySelector("section")?.className).not.toContain("h-full");
    expect(dialog()?.querySelector("[data-card-writing-content]")?.className).toContain("shrink-0");
    expect(dialog()?.querySelector("#christmas-card-nickname")).not.toBeNull();
    expect(dialog()?.querySelector("#christmas-card-message")).not.toBeNull();
    expect(dialog()?.querySelector<HTMLInputElement>("#christmas-card-nickname")?.value).toBe(
      "테스트 사용자",
    );
    expect(dialog()?.querySelector<HTMLInputElement>("#christmas-card-nickname")?.readOnly).toBe(
      false,
    );
    expect(dialog()?.textContent).not.toContain("카드 저장 기능은 준비 중이에요.");
    expect(dialog()?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(
      true,
    );

    await act(async () => {
      dialog()
        ?.querySelector<HTMLTextAreaElement>("#christmas-card-message")
        ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(useGuestbookDialogStore.getState().isOpen).toBe(false);
  });

  it("작성 요청 중 닫고 다시 열어도 늦은 응답이 선택 화면을 바꾸지 않는다", async () => {
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(<DialogHarness onSubmit={onSubmit} />));

    const writeButton = Array.from(dialog()!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("작성하기"),
    );
    await act(async () => writeButton?.click());
    const message = dialog()!.querySelector<HTMLTextAreaElement>("#christmas-card-message")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(message, "따뜻한 겨울 보내세요!");
      message.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      dialog()!
        .querySelector<HTMLFormElement>("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );
    expect(onSubmit).toHaveBeenCalledOnce();

    await act(async () =>
      dialog()!.querySelector<HTMLButtonElement>("button[data-slot='dialog-close']")!.click(),
    );
    await act(async () => container!.querySelector<HTMLButtonElement>("button")!.click());
    expect(dialog()?.textContent).toContain("목록 보기");

    await act(async () => resolveSubmit());
    expect(dialog()?.textContent).toContain("목록 보기");
    expect(dialog()?.textContent).not.toContain("카드를 남겼어요");
  });

  it("저장 완료 화면은 목록 준비 화면과 같은 폭으로 표시한다", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(<DialogHarness onSubmit={onSubmit} />));

    const writeButton = Array.from(dialog()!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("작성하기"),
    );
    await act(async () => writeButton?.click());
    const message = dialog()!.querySelector<HTMLTextAreaElement>("#christmas-card-message")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(message, "따뜻한 겨울 보내세요!");
      message.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      dialog()!
        .querySelector<HTMLFormElement>("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );

    expect(dialog()?.querySelector("section")?.className).toContain("max-w-md");
    expect(dialog()?.querySelector("section")?.className).not.toContain("max-w-6xl");
    expect(dialog()?.querySelector('[role="status"]')?.textContent).toContain("카드를 남겼어요");
  });

  it("카드 저장에 성공하면 작은 완료 팝업을 표시한다", async () => {
    const savedCard: ChristmasCard = {
      id: 2,
      created_at: "2026-11-10T00:00:00.000Z",
      nickname: "눈사람",
      content: "따뜻한 겨울 보내세요!",
      event_type: "christmas",
      user_id: "user-1",
    };
    const onSubmit = vi.fn().mockResolvedValue(savedCard);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root!.render(<DialogHarness onSubmit={onSubmit} />));

    const writeButton = Array.from(dialog()!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("작성하기"),
    );
    await act(async () => writeButton?.click());
    const message = dialog()!.querySelector<HTMLTextAreaElement>("#christmas-card-message")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(message, savedCard.content);
      message.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      dialog()!
        .querySelector<HTMLFormElement>("form")!
        .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
    );

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(dialog()?.querySelector("section")?.className).toContain("max-w-md");
    expect(dialog()?.querySelector('[role="status"]')?.textContent).toContain("카드를 남겼어요");
    expect(dialog()?.textContent).toContain("목록 보기");
    expect(dialog()?.textContent).toContain("닫기");
    expect(dialog()?.textContent).not.toContain("카드 상세 보기");
  });
});
