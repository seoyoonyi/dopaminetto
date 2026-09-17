// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { act } from "react";
import { Root, createRoot } from "react-dom/client";

import { MovementOverlay } from "./MovementOverlay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("MovementOverlay", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("이동 안내 영역을 누르면 전체 조작법 팝오버를 연다", () => {
    act(() => {
      root.render(<MovementOverlay />);
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="캐릭터 조작 안내 열기"]',
    );

    expect(trigger).not.toBeNull();
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");

    act(() => {
      trigger?.click();
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.textContent).toContain("H");
    expect(document.body.textContent).toContain("춤추기");
    expect(document.body.textContent).toContain("채팅 포커스 해제");
  });

  it("Escape를 누르면 조작법 팝오버를 닫는다", () => {
    act(() => {
      root.render(<MovementOverlay />);
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      '[aria-label="캐릭터 조작 안내 열기"]',
    );

    act(() => {
      trigger?.click();
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  });
});
