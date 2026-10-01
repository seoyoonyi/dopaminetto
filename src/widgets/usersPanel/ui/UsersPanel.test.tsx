// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";

import { UsersPanel } from "./UsersPanel";

vi.mock("@/shared/hooks", () => ({ useUserInfo: () => ({ data: null }) }));
vi.mock("@/features/presence/model/useTownPresenceStore", () => ({
  useTownPresenceStore: (selector: (state: object) => unknown) =>
    selector({
      groupedParticipants: {},
      participants: [],
      isConnected: false,
      voiceConnected: false,
      audioEnabled: false,
    }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("UsersPanel", () => {
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

  it("상단 연결 상태를 하단 바와 같은 세 단계로 표시한다", () => {
    const render = (townConnectionStatus: "connected" | "connecting" | "disconnected") => {
      act(() => root.render(<UsersPanel townConnectionStatus={townConnectionStatus} />));
    };
    const indicator = () => container.querySelector<HTMLElement>('[aria-label^="타운 "]')!;

    render("connected");
    expect(indicator().getAttribute("aria-label")).toBe("타운 연결됨");
    expect(indicator().className).toContain("bg-emerald-500");

    render("connecting");
    expect(indicator().getAttribute("aria-label")).toBe("타운 연결 중");
    expect(indicator().className).toContain("bg-amber-400");

    render("disconnected");
    expect(indicator().getAttribute("aria-label")).toBe("타운 연결 안됨");
    expect(indicator().className).toContain("bg-red-500");
  });
});
