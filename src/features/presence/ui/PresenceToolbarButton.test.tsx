// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";

import { useTownPresenceStore } from "../model/useTownPresenceStore";
import { PresenceToolbarButton } from "./PresenceToolbarButton";

vi.mock("@/shared/config/supabase.client", () => ({ supabase: {} }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PresenceToolbarButton", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    useTownPresenceStore.setState({ voiceConnectionStatus: "connecting" });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useTownPresenceStore.setState({ voiceConnectionStatus: "idle" });
  });

  it("연결 중에는 음량 조절기 대신 상태를 보이고 연결 후 조절기를 보여준다", () => {
    act(() => root.render(<PresenceToolbarButton isSpeaker={false} />));

    expect(container.querySelector('[aria-label="방송 음량"]')).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("음성 연결 중…");

    act(() => useTownPresenceStore.setState({ voiceConnectionStatus: "connected" }));

    expect(container.querySelector('[aria-label="방송 음량"]')).not.toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it("연결 실패 시에도 조절기를 숨기고 실패 상태를 보여준다", () => {
    useTownPresenceStore.setState({ voiceConnectionStatus: "error" });
    act(() => root.render(<PresenceToolbarButton isSpeaker={false} />));

    expect(container.querySelector('[aria-label="방송 음량"]')).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("음성 연결 실패");
  });
});
