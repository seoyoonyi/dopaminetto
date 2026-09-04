// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { Root, createRoot } from "react-dom/client";

import MessageField from "./MessageField";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/shared/hooks", () => ({
  useAutoResizeTextarea: () => ({
    textareaRef: { current: null },
    wrapperRef: { current: null },
    isScrollable: false,
  }),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

async function render(props: Partial<Parameters<typeof MessageField>[0]>) {
  const onMessageSend = vi.fn(async () => ({}));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root!.render(
      <MessageField roomId="village:lobby" canSend onMessageSend={onMessageSend} {...props} />,
    );
  });

  return { onMessageSend };
}

const type = async (value: string) => {
  const textarea = container!.querySelector("textarea")!;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )!.set!;
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const pressEnter = async () => {
  const textarea = container!.querySelector("textarea")!;
  await act(async () => {
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
};

describe("MessageField: 전송 가능 여부는 canSend로만 결정된다", () => {
  it("canSend=true면 realtime 상태와 무관하게 전송된다", async () => {
    const { onMessageSend } = await render({ canSend: true });

    await type("hello");
    expect(container!.querySelector("button")!.disabled).toBe(false);

    await pressEnter();
    expect(onMessageSend).toHaveBeenCalledWith("hello");
  });

  it("canSend=false면 전송되지 않고 버튼이 비활성화된다", async () => {
    const { onMessageSend } = await render({ canSend: false });

    await type("hello");
    await pressEnter();

    expect(onMessageSend).not.toHaveBeenCalled();
    expect(container!.querySelector("button")!.disabled).toBe(true);
  });
});
