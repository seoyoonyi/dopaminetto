// @vitest-environment jsdom
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

import { act } from "react";
import { Root, createRoot } from "react-dom/client";

import { Toaster } from "./sonner";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Sonner 이벤트 리스너 정리", () => {
  let container: HTMLDivElement;
  let root: Root;
  let documentAddSpy: MockInstance<Document["addEventListener"]>;
  let documentRemoveSpy: MockInstance<Document["removeEventListener"]>;
  let windowRemoveSpy: MockInstance<Window["removeEventListener"]>;
  let originalDocumentRemove: Document["removeEventListener"];

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    originalDocumentRemove = document.removeEventListener.bind(document);
    documentAddSpy = vi.spyOn(document, "addEventListener");
    documentRemoveSpy = vi.spyOn(document, "removeEventListener");
    windowRemoveSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(async () => {
    await act(async () => {
      toast.dismiss();
      root.unmount();
    });

    for (const [type, listener, options] of documentAddSpy.mock.calls) {
      if (type === "visibilitychange" && listener) {
        originalDocumentRemove(type, listener, options);
      }
    }

    vi.restoreAllMocks();
    container.remove();
  });

  it("토스트가 자동으로 닫히면 visibilitychange 리스너가 document에서 해제된다", async () => {
    await act(async () => root.render(<Toaster theme="light" />));

    const registeredCallbacks: EventListenerOrEventListenerObject[] = [];

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const id = `sonner-listener-cleanup-${attempt}`;
      const addCallStart = documentAddSpy.mock.calls.length;

      await act(async () => {
        toast.info(`리스너 정리 확인 ${attempt}`, { id, duration: 10 });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(container.querySelectorAll("[data-sonner-toast]")).toHaveLength(1);

      const callback = documentAddSpy.mock.calls
        .slice(addCallStart)
        .find(([type]) => type === "visibilitychange")?.[1];
      expect(callback).toBeDefined();
      registeredCallbacks.push(callback!);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 350));
      });

      expect(container.querySelectorAll("[data-sonner-toast]")).toHaveLength(0);
      expect(documentRemoveSpy).toHaveBeenCalledWith("visibilitychange", callback);
    }

    expect(registeredCallbacks).toHaveLength(3);
    expect(windowRemoveSpy.mock.calls.filter(([type]) => type === "visibilitychange")).toHaveLength(
      0,
    );
  });
});
