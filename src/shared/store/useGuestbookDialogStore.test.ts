import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGuestbookDialogStore } from "./useGuestbookDialogStore";

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
});
