// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { act } from "react";
import { createRoot } from "react-dom/client";

import { useMessagesQuery } from "./useMessagesQuery";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { useInfiniteQueryMock } = vi.hoisted(() => ({
  useInfiniteQueryMock: vi.fn(() => ({})),
}));

vi.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: useInfiniteQueryMock,
}));

vi.mock("@/app/providers/SupabaseProvider", () => ({
  useSupabase: () => ({}),
}));

vi.mock("../api/fetchMessages", () => ({
  fetchMessages: vi.fn(),
}));

const renderHook = async (run: () => void) => {
  const container = document.createElement("div");
  const root = createRoot(container);

  function Harness() {
    run();
    return null;
  }

  await act(async () => {
    root.render(<Harness />);
  });

  return () => act(() => root.unmount());
};

describe("useMessagesQuery: reconcileIntervalMs", () => {
  it("reconcileIntervalMs를 refetchInterval로 전달한다", async () => {
    useInfiniteQueryMock.mockClear();
    const unmount = await renderHook(() => {
      useMessagesQuery("village:lobby", { reconcileIntervalMs: 15_000 });
    });

    expect(useInfiniteQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ refetchInterval: 15_000 }),
    );

    await unmount();
  });

  it("옵션을 주지 않으면 refetchInterval이 false다(폴링하지 않음)", async () => {
    useInfiniteQueryMock.mockClear();
    const unmount = await renderHook(() => {
      useMessagesQuery("village:lobby");
    });

    expect(useInfiniteQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ refetchInterval: false }),
    );

    await unmount();
  });
});
