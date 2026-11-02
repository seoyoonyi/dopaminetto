// @vitest-environment jsdom
import { useGuestbookDialogStore } from "@/shared/store/useGuestbookDialogStore";
import { ChristmasGuestbook } from "@/widgets/christmasGuestbook";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { useState } from "react";
import { type Root, createRoot } from "react-dom/client";

import { ChristmasCardDialog } from "./ChristmasCardDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockUseUserInfo = vi.hoisted(() => vi.fn());

vi.mock("@/shared/hooks/useUserInfo", () => ({ useUserInfo: mockUseUserInfo }));

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
  useGuestbookDialogStore.setState({ isOpen: false, position: null });
});

async function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root!.render(<ChristmasGuestbook />));
}

function DialogHarness({
  onSubmit,
}: {
  onSubmit: (nickname: string, message: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setOpen(true)} type="button">
        다시 열기
      </button>
      <ChristmasCardDialog
        nickname="눈사람"
        onOpenChange={setOpen}
        onSubmit={onSubmit}
        open={open}
        position={null}
      />
    </>
  );
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
    expect(dialog()?.querySelector("#christmas-card-nickname")).not.toBeNull();
    expect(dialog()?.querySelector("#christmas-card-message")).not.toBeNull();
    expect(dialog()?.querySelector<HTMLInputElement>("#christmas-card-nickname")?.value).toBe(
      "테스트 사용자",
    );
    expect(dialog()?.querySelector<HTMLInputElement>("#christmas-card-nickname")?.readOnly).toBe(
      false,
    );
    expect(dialog()?.textContent).toContain("카드 저장 기능은 준비 중이에요.");
    expect(dialog()?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(
      true,
    );

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
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
});
