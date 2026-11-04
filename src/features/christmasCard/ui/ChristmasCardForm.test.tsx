// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";

import { ChristmasCardForm } from "./ChristmasCardForm";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

async function render(props: Partial<React.ComponentProps<typeof ChristmasCardForm>> = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <ChristmasCardForm nickname="눈사람" onBack={vi.fn()} onViewList={vi.fn()} {...props} />,
    );
  });
}

const form = () => container!.querySelector<HTMLFormElement>("form")!;
const messageField = () =>
  container!.querySelector<HTMLTextAreaElement>("#christmas-card-message")!;
const submitButton = () => form().querySelector<HTMLButtonElement>('button[type="submit"]')!;

async function setMessage(value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    setter.call(messageField(), value);
    messageField().dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("ChristmasCardForm", () => {
  it("메시지가 비어 있을 때 안내 문구를 입력 시작 위치에 표시하고 입력하면 숨긴다", async () => {
    await render();

    const placeholder = container!.querySelector<HTMLElement>("[data-card-message-placeholder]");
    expect(placeholder?.textContent).toBe(
      "도파민또에 남기고 싶은 이야기를 180자 안에 담아보세요. 🎄",
    );
    expect(placeholder?.className).toContain("items-start");
    expect(placeholder?.className).toContain("justify-center");

    await setMessage("메리 크리스마스!");
    expect(container!.querySelector("[data-card-message-placeholder]")).toBeNull();
  });

  it("입력한 메시지는 짧거나 길어도 같은 위쪽 여백에서 시작한다", async () => {
    await render();
    const field = messageField();

    await setMessage("짧은 메시지");
    expect(field.style.paddingTop).toBe("");

    await setMessage("긴 메시지".repeat(25));
    expect(field.style.paddingTop).toBe("");
  });

  it("로그인 닉네임을 수정 가능한 기본값으로 표시하고 글자 수와 한 개의 카드 템플릿을 제공한다", async () => {
    await render();

    expect(container!.querySelector<HTMLInputElement>("#christmas-card-nickname")?.value).toBe(
      "눈사람",
    );
    expect(container!.querySelector<HTMLInputElement>("#christmas-card-nickname")?.readOnly).toBe(
      false,
    );
    expect(container!.querySelector('label[for="christmas-card-nickname"]')?.textContent).toBe(
      "From.",
    );
    expect(messageField().maxLength).toBe(180);
    expect(container!.textContent).toContain("0 / 180");
    expect(container!.querySelector('label[for="christmas-card-message"]')?.textContent).toBe(
      "메시지 개수",
    );
    expect(
      container!.querySelector('label[for="christmas-card-message"]')?.parentElement?.className,
    ).toContain("justify-between");
    expect(
      container!.querySelector('label[for="christmas-card-message"]')?.parentElement?.className,
    ).toContain("text-[#63322d]");
    expect(container!.querySelectorAll('[data-card-template="true"]')).toHaveLength(1);
    expect(container!.querySelector('[data-card-template="true"]')?.className).toContain(
      "aspect-video",
    );
    expect(container!.querySelector('[data-card-template="true"]')?.className).toContain("w-full");
    expect(container!.querySelector('[data-card-template="true"]')?.className).not.toContain(
      "max-w-5xl",
    );
    expect(container!.querySelector('[data-card-template="true"]')?.className).toContain(
      "max-w-none",
    );
    expect(container!.querySelector('[data-card-template="true"]')?.className).not.toContain(
      "h-full",
    );
    expect(messageField().className).toContain("text-xl");
    expect(messageField().className).toContain("text-left");
    expect(messageField().className).toContain("text-sm");
    expect(messageField().className).not.toContain("text-xs");
    expect(messageField().className).toContain("sm:text-base");
    expect(messageField().className).toContain("md:text-lg");
    expect(messageField().className).toContain("lg:text-xl");
    expect(messageField().className).not.toContain("lg:text-2xl");
    expect(messageField().className).toContain("max-[920px]:text-sm");
    expect(messageField().className).toContain("max-[920px]:leading-5");
    expect(messageField().className).toContain("leading-5");
    expect(messageField().className).toContain("sm:leading-6");
    expect(messageField().className).toContain("md:leading-7");
    expect(messageField().className).toContain("lg:leading-8");
    expect(messageField().className).toContain("overflow-hidden");
    expect(messageField().className).not.toContain("overflow-y-auto");
    expect(messageField().className).toContain("field-sizing-content");
    expect(messageField().className).not.toContain("size-full");
    expect(messageField().parentElement?.className).toContain("christmas-card-message-focus");
    expect(container!.querySelector("[data-card-message-placeholder]")?.className).toContain(
      "text-center",
    );
    expect(messageField().parentElement?.className).toContain("top-[24%]");
    expect(messageField().parentElement?.className).toContain("max-[920px]:top-[32%]");
    expect(messageField().parentElement?.className).toContain("items-start");
    expect(messageField().parentElement?.className).toContain("bottom-0");
    expect(messageField().parentElement?.className).toContain("min-[921px]:top-[28%]");
    expect(messageField().parentElement?.className).toContain("min-[921px]:bottom-[30%]");
    expect(messageField().parentElement?.className).toContain(
      "min-[1024px]:max-[1279px]:bottom-[32%]",
    );
    expect(messageField().parentElement?.className).not.toContain("sm:bottom-[30%]");
    expect(messageField().parentElement?.className).toContain("p-0");
    expect(messageField().parentElement?.className).toContain("sm:p-3");
    expect(messageField().parentElement?.className).toContain("lg:p-4");
    expect(container!.querySelector("video")?.loop).toBe(true);
    expect(container!.querySelector("video")?.muted).toBe(true);
    expect(container!.querySelector("video")?.playsInline).toBe(true);
    expect(container!.querySelector("video")?.getAttribute("autoplay")).not.toBeNull();
    expect(container!.querySelector("video source")?.getAttribute("src")).toBe(
      "/assets/media/christmas_card_A.mp4",
    );
    expect(container!.querySelector("video")?.className).toContain("min-w-[320px]");
    expect(container!.querySelector("video")?.className).toContain("min-h-[180px]");
    expect(container!.querySelector("img")?.getAttribute("alt")).toBe("");
  });

  it("닉네임을 수정해 메시지와 함께 앞뒤 공백을 정리해 제출한다", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    await render({ onSubmit });

    const nicknameField = container!.querySelector<HTMLInputElement>("#christmas-card-nickname")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(nicknameField, "  별빛  ");
      nicknameField.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await setMessage("  메리 크리스마스!  ");
    await submit();

    expect(onSubmit).toHaveBeenCalledWith("별빛", "메리 크리스마스!");
  });

  it("닉네임이 비었거나 12자를 초과하면 제출할 수 없다", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    await render({ onSubmit });

    const nicknameField = container!.querySelector<HTMLInputElement>("#christmas-card-nickname")!;
    const setNickname = async (value: string) => {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        setter.call(nicknameField, value);
        nicknameField.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };

    await setNickname("   ");
    expect(submitButton().disabled).toBe(true);
    await setNickname("가".repeat(13));
    expect(submitButton().disabled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("작성 콜백이 없으면 메시지를 입력해도 실제 저장처럼 제출할 수 없다", async () => {
    const onSubmit = vi.fn();
    await render({ onSubmit: undefined });
    await setMessage("메리 크리스마스!");

    expect(submitButton().disabled).toBe(true);
    expect(container!.textContent).toContain("카드 저장 기능은 준비 중이에요.");

    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("닉네임이 준비되지 않으면 제출을 차단하고 안내한다", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    await render({ nickname: "", onSubmit });
    await setMessage("메리 크리스마스!");

    expect(submitButton().disabled).toBe(true);
    expect(container!.textContent).toContain("닉네임을 입력해 주세요.");
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("공백 메시지는 제출하지 않고 유효한 문장은 앞뒤 공백을 정리해 제출한다", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    await render({ onSubmit });

    await setMessage("   \n ");
    expect(submitButton().disabled).toBe(true);
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();

    await setMessage("  따뜻한 연말 보내세요!  ");
    expect(container!.textContent).toContain(`${"  따뜻한 연말 보내세요!  ".length} / 180`);
    await submit();

    expect(onSubmit).toHaveBeenCalledWith("눈사람", "따뜻한 연말 보내세요!");
    expect(container!.querySelector('[role="status"]')?.textContent).toContain("카드를 남겼어요");
    expect(container!.textContent).toContain("따뜻한 연말 보내세요!");
  });

  it("저장 실패 시 작성 내용을 유지하고 재시도 안내를 표시한다", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error("offline"));
    await render({ onSubmit });
    await setMessage("다시 만나요!");

    await submit();

    expect(container!.querySelector('[role="alert"]')?.textContent).toContain(
      "카드를 저장하지 못했어요. 다시 시도해 주세요.",
    );
    expect(messageField().value).toBe("다시 만나요!");
    expect(submitButton().disabled).toBe(false);
  });

  it("저장이 진행되는 동안 중복 제출을 막고 완료 후 다시 작성할 수 있다", async () => {
    let resolveSubmit!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    const onSubmit = vi.fn(() => pending);
    const onViewList = vi.fn();
    await render({ onSubmit, onViewList });
    await setMessage("행복한 겨울 보내요!");

    await act(async () => {
      form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(submitButton().disabled).toBe(true);
    expect(submitButton().textContent).toContain("보내는 중");

    await act(async () => resolveSubmit());
    expect(container!.querySelector('[role="status"]')?.textContent).toContain("카드를 남겼어요");

    const listButton = Array.from(container!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("목록 보기"),
    );
    await act(async () => listButton?.click());
    expect(onViewList).toHaveBeenCalledOnce();
    expect(container!.querySelector('[role="status"]')?.textContent).toContain("카드를 남겼어요");
  });
});
