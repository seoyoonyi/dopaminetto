// @vitest-environment jsdom
import { useGuestbookDialogStore } from "@/shared/store/useGuestbookDialogStore";
import { ChristmasGuestbook } from "@/widgets/christmasGuestbook";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  useGuestbookDialogStore.setState({ isOpen: false, position: null });
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  useGuestbookDialogStore.setState({ isOpen: false, position: null });
});

async function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<ChristmasGuestbook />));
}

function dialog() {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

describe("ChristmasGuestbook", () => {
  it("트리 클릭 위치에 오버레이 없이 작은 선택 메뉴를 표시한다", async () => {
    await render();
    expect(dialog()).toBeNull();

    act(() => useGuestbookDialogStore.getState().setOpen(true, { x: 500, y: 300 }));

    expect(dialog()?.textContent).toContain("크리스마스 카드");
    expect(dialog()?.querySelector("img")).toBeNull();
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
    expect(document.body.style.pointerEvents).not.toBe("none");
    expect(dialog()?.className).toContain("bg-[var(--winter-town-canvas-background)]");
    expect(dialog()?.className).toContain("p-0");
    expect(dialog()?.className).toContain("w-48");
    expect(dialog()?.className).toContain("z-40");
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
    expect(dialog()?.style.getPropertyValue("--anchor-x")).toBe("500px");
    expect(dialog()?.style.getPropertyValue("--anchor-y")).toBe("300px");
    const writeButton = dialog()?.querySelector<HTMLButtonElement>("button[data-primary='true']");
    expect(writeButton?.textContent).toContain("작성하기");
    expect(writeButton?.className).toContain("bg-[#f1c6bd]");
    expect(writeButton?.className).toContain("cursor-pointer");
  });

  it("갤러리가 연결되기 전 목록 보기를 비활성화하고 안내한다", async () => {
    await render();
    act(() => useGuestbookDialogStore.getState().setOpen(true));

    const listButton = Array.from(dialog()!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("목록 보기"),
    );

    expect(listButton?.disabled).toBe(true);
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

  it("작성하기는 준비 상태 안내로 전환하고 Escape는 팝업을 닫는다", async () => {
    await render();
    act(() => useGuestbookDialogStore.getState().setOpen(true));
    const writeButton = Array.from(dialog()!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("작성하기"),
    );

    await act(async () => writeButton?.click());
    expect(dialog()?.textContent).toContain("카드 작성 화면은 다음 단계에서 준비할게요.");

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(useGuestbookDialogStore.getState().isOpen).toBe(false);
  });
});
