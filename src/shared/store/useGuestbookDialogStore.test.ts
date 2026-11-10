// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import { useGuestbookDialogStore } from "./useGuestbookDialogStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("useGuestbookDialogStore", () => {
  beforeEach(() => {
    useGuestbookDialogStore.setState({ isOpen: false });
  });

  it("기본적으로 닫힌 상태로 시작한다", () => {
    expect(useGuestbookDialogStore.getState().isOpen).toBe(false);
  });

  it("열기와 닫기 상태를 구독자에게 알린다", () => {
    const listener = vi.fn();
    const unsubscribe = useGuestbookDialogStore.subscribe(listener);

    useGuestbookDialogStore.getState().setOpen(true);
    expect(useGuestbookDialogStore.getState().isOpen).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    useGuestbookDialogStore.getState().setOpen(false);
    expect(useGuestbookDialogStore.getState().isOpen).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  it("현재 상태와 같은 값을 다시 설정해도 열림 상태를 유지한다", () => {
    useGuestbookDialogStore.getState().setOpen(true);
    useGuestbookDialogStore.getState().setOpen(true);

    expect(useGuestbookDialogStore.getState().isOpen).toBe(true);
  });

  it("React 컴포넌트에서 열림과 닫힘 상태를 확인한다", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    function Consumer() {
      const isOpen = useGuestbookDialogStore((state) => state.isOpen);
      return createElement("span", null, isOpen ? "열림" : "닫힘");
    }

    await act(async () => root.render(createElement(Consumer)));
    expect(container.textContent).toBe("닫힘");

    await act(async () => useGuestbookDialogStore.getState().setOpen(true));
    expect(container.textContent).toBe("열림");

    await act(async () => useGuestbookDialogStore.getState().setOpen(false));
    expect(container.textContent).toBe("닫힘");

    await act(async () => root.unmount());
  });
});
