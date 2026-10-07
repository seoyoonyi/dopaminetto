// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";

import { UsersPanelToggleButton } from "./UsersPanelToggleButton";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("UsersPanelToggleButton", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("현재 패널에 따라 전환 버튼의 아이콘과 표시 내용을 바꾼다", () => {
    const onToggle = vi.fn();

    act(() =>
      root.render(
        <UsersPanelToggleButton participantCount={3} isUsersPanel={false} onToggle={onToggle} />,
      ),
    );

    const button = container.querySelector("button")!;
    expect(button.textContent).toBe("3");
    expect(button.textContent).not.toContain("사용자");
    expect(button.className).toContain("w-12");
    expect(button.className).toContain("sm:w-auto");
    expect(button.className).toContain("justify-start");
    expect(button.getAttribute("aria-label")).toBe("사용자 패널로 보기, 3명");
    expect(button.title).toBe("사용자 패널로 보기 · 3명");
    expect(button.querySelector("svg.lucide-users")).not.toBeNull();
    act(() => button.click());
    expect(onToggle).toHaveBeenCalledTimes(1);

    act(() =>
      root.render(<UsersPanelToggleButton participantCount={3} isUsersPanel onToggle={onToggle} />),
    );

    expect(button.textContent).toBe("채팅");
    expect(button.getAttribute("aria-label")).toBe("채팅 패널로 보기, 3명");
    expect(button.title).toBe("채팅 패널로 보기 · 3명");
    expect(button.className).toContain("w-16");
    expect(button.querySelector("svg.lucide-message-circle")).not.toBeNull();
    expect(button.hasAttribute("aria-pressed")).toBe(false);
    act(() => button.click());
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("패널 전환 버튼에는 연결 상태를 표시하지 않는다", () => {
    act(() => root.render(<UsersPanelToggleButton participantCount={3} isUsersPanel={false} />));

    const button = container.querySelector("button")!;
    expect(button.textContent).toBe("3");
    expect(button.textContent).not.toContain("사용자");
    expect(button.querySelector('[role="status"]')).toBeNull();
  });
});
