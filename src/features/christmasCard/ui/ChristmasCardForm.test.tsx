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
  vi.restoreAllMocks();
  vi.clearAllMocks();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

async function render(props: Partial<React.ComponentProps<typeof ChristmasCardForm>> = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <ChristmasCardForm
        nickname="눈사람"
        onBack={vi.fn()}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        onViewList={vi.fn()}
        {...props}
      />,
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

async function typeText(text: string) {
  const field = messageField();
  const start = field.selectionStart;
  const end = field.selectionEnd;

  await act(async () => {
    field.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: text }));
    const beforeInput = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      data: text,
      inputType: "insertText",
    });
    field.dispatchEvent(beforeInput);
    if (beforeInput.defaultPrevented) return;

    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    setter.call(field, `${field.value.slice(0, start)}${text}${field.value.slice(end)}`);
    field.setSelectionRange(start + text.length, start + text.length);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

async function compose(type: "compositionstart" | "compositionend", data = "") {
  await act(async () => {
    messageField().dispatchEvent(new CompositionEvent(type, { bubbles: true, data }));
  });
}

describe("ChristmasCardForm", () => {
  it("모션 감소 설정이 켜지면 영상을 빼고 설정 변경을 따라 다시 렌더링한다", async () => {
    let matches = true;
    let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
    const mediaQuery = {
      get matches() {
        return matches;
      },
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        changeListener = listener as (event: MediaQueryListEvent) => void;
      },
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.spyOn(window, "matchMedia").mockReturnValue(mediaQuery);

    await render();
    expect(container!.querySelector("video")).toBeNull();
    expect(container!.querySelector("video source")).toBeNull();
    expect(container!.querySelector("img")?.getAttribute("alt")).toBe("");

    matches = false;
    await act(async () => changeListener?.(new Event("change") as MediaQueryListEvent));
    expect(container!.querySelector("video source")?.getAttribute("src")).toBe(
      "/assets/media/christmas_card_A.mp4",
    );

    matches = true;
    await act(async () => changeListener?.(new Event("change") as MediaQueryListEvent));
    expect(container!.querySelector("video")).toBeNull();
  });

  it("메시지가 비어 있을 때 안내 문구를 입력 시작 위치에 표시하고 입력하면 숨긴다", async () => {
    await render();

    expect(form().querySelector('label[for="christmas-card-message"]')?.textContent).toBe(
      "메시지 제한: 180자",
    );

    const listButton = Array.from(form().querySelectorAll("button")).find((button) =>
      button.textContent?.includes("목록 보기"),
    );
    const cardButton = submitButton();
    for (const button of [listButton, cardButton]) {
      expect(button?.className).toContain("w-full");
      expect(button?.className).toContain("sm:w-32");
      expect(button?.className).toContain("px-2");
      expect(button?.querySelector("span")?.className).toContain("justify-center");
      expect(button?.querySelector("span")?.className).toContain("sm:justify-evenly");
    }

    const placeholder = container!.querySelector<HTMLElement>("[data-card-message-placeholder]");
    expect(placeholder?.textContent).toBe(
      "도파민또에 남기고 싶은 이야기를 180자 안에 담아보세요. 🎄",
    );
    expect(placeholder?.className).toContain("items-start");
    expect(placeholder?.className).toContain("justify-center");
    expect(placeholder?.className.split(" ")).toContain(
      "[@media(min-width:500px)_and_(max-width:540px)]:!text-[0.84375rem]",
    );
    expect(placeholder?.className.split(" ")).toContain(
      "[@media(min-width:541px)_and_(max-width:711px)]:!text-[0.875rem]",
    );
    expect(placeholder?.className.split(" ")).toContain(
      "[@media(min-width:712px)_and_(max-width:920px)]:!text-[1rem]",
    );
    expect(messageField().className.split(" ")).toContain(
      "[@media(min-width:500px)_and_(max-width:540px)]:!text-[0.84375rem]",
    );
    expect(messageField().className.split(" ")).toContain(
      "[@media(min-width:541px)_and_(max-width:711px)]:!text-[0.875rem]",
    );
    expect(messageField().className.split(" ")).toContain(
      "[@media(min-width:712px)_and_(max-width:920px)]:!text-[1rem]",
    );

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

  it("화면 높이와 무관하게 6줄을 넘는 직접 입력을 허용한다", async () => {
    await render();
    const sevenLines = Array(7).fill("내용").join("\n");
    await setMessage(sevenLines);
    expect(messageField().value).toBe(sevenLines);
  });

  it("붙여넣기는 줄 수가 아니라 180자 제한만 적용한다", async () => {
    await render();
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { getData: () => Array(8).fill("가가가").join("\n") + "x".repeat(180) },
    });
    await act(async () => messageField().dispatchEvent(pasteEvent));

    expect(messageField().value).toHaveLength(180);
  });

  it("179자에서 조합 중 181자가 되어도 자르지 않고 완료된 180자만 제출한다", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    await render({ onSubmit });
    const prefix = "메리 크리스마스! ".repeat(18).slice(0, 179);
    expect(prefix).toHaveLength(179);
    await setMessage(prefix);
    await compose("compositionstart");
    await setMessage(`${prefix}ㅎㅏ`);
    expect(messageField().value).toHaveLength(181);
    expect(container!.textContent).toContain("181 / 180");
    expect(submitButton().disabled).toBe(true);
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();

    await setMessage(`${prefix}하`);
    await compose("compositionend", "하");
    await setMessage(`${prefix}하`);
    expect(messageField().value).toBe(`${prefix}하`);
    expect(container!.textContent).toContain("180 / 180");
    expect(submitButton().disabled).toBe(false);
    await submit();
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("눈사람", `${prefix}하`.trim());
  });

  it("한글 조합 중에도 입력창에 보이는 글자 수를 카운터에 반영한다", async () => {
    await render({ onSubmit: vi.fn() });
    const prefix = "가".repeat(179);
    await setMessage(prefix);
    await compose("compositionstart");
    await setMessage(`${prefix}ㄱ`);

    expect(messageField().value).toBe(`${prefix}ㄱ`);
    expect(container!.textContent).toContain("180 / 180");
    expect(submitButton().disabled).toBe(true);

    await setMessage(`${prefix}가`);
    await compose("compositionend", "가");
    expect(container!.textContent).toContain("180 / 180");
    expect(submitButton().disabled).toBe(false);
  });

  it("180자의 중간에서 181자가 되는 조합을 거절하고 뒤 원문과 선택 위치를 보존한다", async () => {
    await render();
    const original = `${"가".repeat(179)}끝`;
    await setMessage(original);
    messageField().setSelectionRange(179, 179);
    await compose("compositionstart");
    await setMessage(`${"가".repeat(179)}한끝`);
    expect(messageField().value).toHaveLength(181);
    await compose("compositionend", "한");
    expect(messageField().value).toBe(original);
    expect(messageField().selectionStart).toBe(179);
    expect(container!.textContent).toContain("180 / 180");
    await setMessage(`${"가".repeat(179)}한끝`);
    expect(messageField().value).toBe(original);
    expect(messageField().selectionStart).toBe(179);
  });

  it("180자에서 선택한 한 글자를 한글 조합으로 교체할 수 있다", async () => {
    await render();
    await setMessage(`${"가".repeat(179)}끝`);
    messageField().setSelectionRange(179, 180);
    await compose("compositionstart");
    await setMessage(`${"가".repeat(179)}한`);
    await compose("compositionend", "한");
    expect(messageField().value).toBe(`${"가".repeat(179)}한`);
    expect(container!.textContent).toContain("180 / 180");
  });

  it("조합 종료 시 180자 미만이면 줄 수와 무관하게 메시지를 반영한다", async () => {
    await render();
    const original = Array(8).fill("가".repeat(20)).join("\n");
    expect(original).toHaveLength(167);
    await setMessage(original);
    await compose("compositionstart");
    await setMessage(`${original}\n한`);
    expect(messageField().value).toHaveLength(169);
    await compose("compositionend", "한");
    expect(messageField().value).toBe(`${original}\n한`);
  });

  it.each(["가", "i"])("일반 %s 입력도 180자는 허용하고 181자는 남기지 않는다", async (letter) => {
    await render();
    await setMessage(letter.repeat(180));
    expect(messageField().value).toHaveLength(180);
    await setMessage(letter.repeat(181));
    expect(messageField().value).toBe(letter.repeat(180));
  });

  it("180자에서 중간 입력을 거절해 기존 끝 글자와 커서 위치를 보존한다", async () => {
    await render();
    const original = `${"가".repeat(179)}끝`;
    await setMessage(original);
    messageField().setSelectionRange(90, 90);

    await typeText("나");

    expect(messageField().value).toBe(original);
    expect(messageField().selectionStart).toBe(90);
    expect(messageField().selectionEnd).toBe(90);
  });

  it("710px 이하 글꼴을 적용하면서 한글 180자 입력을 허용한다", async () => {
    await render();
    await setMessage("가".repeat(180));
    expect(messageField().value).toBe("가".repeat(180));
    expect(container!.textContent).toContain("180 / 180");
  });

  it("179자에서 조합 완료값이 180자면 줄 수와 무관하게 반영한다", async () => {
    await render();
    const prefix = "가".repeat(179);
    await setMessage(prefix);
    await compose("compositionstart");
    await setMessage(`${prefix}한`);
    expect(messageField().value).toHaveLength(180);
    await compose("compositionend", "한");
    expect(messageField().value).toBe(`${prefix}한`);
    expect(container!.textContent).toContain("180 / 180");
  });

  it("179자에서 조합 시작과 같은 이벤트 묶음의 submit도 이전 값으로 저장하지 않는다", async () => {
    const onSubmit = vi.fn();
    await render({ onSubmit });
    await setMessage("i".repeat(179));
    await act(async () => {
      messageField().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("179자에서 조합 중 붙여넣기는 확정값을 덮어쓰지 않고 blur로 180자 조합을 확정한다", async () => {
    await render({ onSubmit: vi.fn() });
    const prefix = "가".repeat(179);
    await setMessage(prefix);
    await act(async () => messageField().focus());
    await compose("compositionstart");
    await setMessage(`${prefix}한`);
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: { getData: () => "붙여넣기" } });
    await act(async () => messageField().dispatchEvent(paste));
    expect(paste.defaultPrevented).toBe(true);
    expect(messageField().value).toBe(`${prefix}한`);
    expect(container!.textContent).toContain("180 / 180");
    await act(async () => messageField().blur());
    await compose("compositionend", "한");
    expect(container!.textContent).toContain("180 / 180");
    expect(submitButton().disabled).toBe(false);
  });

  it("180자 조합 취소 뒤 삭제하고 새 조합을 시작할 수 있다", async () => {
    await render({ onSubmit: vi.fn() });
    const original = "가".repeat(180);
    await setMessage(original);
    await compose("compositionstart");
    await setMessage(`${original}ㅎ`);
    await setMessage(original);
    await compose("compositionend");
    await setMessage(original.slice(0, -1));
    await compose("compositionstart");
    await setMessage(`${original.slice(0, -1)}한`);
    await compose("compositionend", "한");
    expect(messageField().value).toBe(`${original.slice(0, -1)}한`);
    expect(submitButton().disabled).toBe(false);
  });

  it("여러 수동 줄바꿈이 있어도 붙여넣은 내용을 보존한다", async () => {
    await render();
    const prefix = `${Array(5).fill("1").join("\n")}\n`;
    await setMessage(prefix);
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { getData: () => "1".repeat(20) },
    });
    await act(async () => messageField().dispatchEvent(pasteEvent));

    expect(messageField().value).toBe(`${prefix}${"1".repeat(20)}`);
    expect(document.querySelector('textarea[aria-hidden="true"]')).toBeNull();
  });

  it("붙여넣은 수동 줄바꿈을 부모 높이와 무관하게 보존한다", async () => {
    await render();
    const field = messageField();
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { getData: () => "첫째\n둘째\n셋째\n넷째\n다섯째" },
    });

    await act(async () => field.dispatchEvent(pasteEvent));

    expect(field.value).toBe("첫째\n둘째\n셋째\n넷째\n다섯째");
    expect(container!.textContent).toContain("15 / 180");
  });

  it("붙여넣은 한 줄 텍스트는 부모 높이와 무관하게 180자까지 반영한다", async () => {
    await render();
    const field = messageField();
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { getData: () => "1".repeat(50) },
    });

    await act(async () => field.dispatchEvent(pasteEvent));

    expect(field.value).toBe("1".repeat(50));
    expect(container!.textContent).toContain("50 / 180");
  });

  it("수동 줄바꿈 뒤 붙여넣어도 앞 내용을 유지한다", async () => {
    await render();
    const field = messageField();
    await setMessage("1\n1\n");
    const pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, "clipboardData", {
      value: { getData: () => "123456789012345678901234567890" },
    });

    await act(async () => field.dispatchEvent(pasteEvent));

    expect(field.value).toBe("1\n1\n123456789012345678901234567890");
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
    expect(messageField().maxLength).toBe(-1);
    expect(container!.textContent).toContain("0 / 180");
    expect(container!.querySelector('label[for="christmas-card-message"]')?.textContent).toBe(
      "메시지 제한: 180자",
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
    expect(messageField().className.split(" ")).toContain("text-center");
    expect(messageField().className).not.toContain("min-[641px]:text-left");
    expect(messageField().className).toContain("text-sm");
    expect(messageField().className.split(" ")).not.toContain("text-xs");
    expect(messageField().className).toContain("sm:text-base");
    expect(messageField().className).toContain("md:text-lg");
    expect(messageField().className).toContain("lg:text-xl");
    expect(messageField().className).not.toContain("lg:text-2xl");
    expect(messageField().className).toContain("max-[920px]:text-sm");
    expect(messageField().className).toContain(
      "[@media(min-width:500px)_and_(max-width:540px)]:!text-[0.84375rem]",
    );
    expect(messageField().className).toContain("max-[920px]:leading-5");
    expect(messageField().className).toContain("leading-5");
    expect(messageField().className).toContain("sm:leading-6");
    expect(messageField().className).toContain("md:leading-7");
    expect(messageField().className).toContain("lg:leading-8");
    expect(messageField().className).toContain("overflow-hidden");
    expect(messageField().className).not.toContain("overflow-y-auto");
    expect(messageField().className).toContain("field-sizing-fixed");
    expect(messageField().className.split(" ")).toContain("h-full");
    expect(messageField().className).toContain("max-h-full");
    expect(messageField().className).not.toContain("min-[921px]:h-full");
    expect(messageField().className).not.toContain("size-full");
    expect(messageField().parentElement?.className).toContain("christmas-card-message-focus");
    expect(messageField().parentElement?.className).toContain("christmas-card-lines");
    expect(container!.querySelector("[data-card-message-placeholder]")?.className).toContain(
      "text-center",
    );
    expect(messageField().parentElement?.className).toContain("top-[24%]");
    expect(messageField().parentElement?.className).toContain("max-[920px]:top-[32%]");
    expect(messageField().parentElement?.className).toContain(
      "[@media(max-width:920px)]:top-[calc(32%_-_0.5lh)]",
    );
    expect(messageField().parentElement?.className).toContain("items-start");
    expect(messageField().parentElement?.className).toContain(
      "-translate-y-[clamp(8px,1.5vw,20px)]",
    );
    expect(messageField().parentElement?.className).toContain(
      "h-[calc(var(--card-message-lines)*1lh_+_18px)]",
    );
    expect(messageField().parentElement?.className).toContain(
      "[@media(min-width:500px)_and_(max-width:540px)]:h-[calc(var(--card-message-lines)*1lh_+_22px)]",
    );
    expect(messageField().parentElement?.className).toContain(
      "sm:h-[calc(var(--card-message-lines)*1lh_+_42px)]",
    );
    expect(messageField().parentElement?.className).toContain(
      "lg:h-[calc(var(--card-message-lines)*1lh_+_50px)]",
    );
    expect(messageField().parentElement?.getAttribute("style")).toContain(
      "--card-message-lines: 6",
    );
    expect(messageField().parentElement?.className).toContain("min-[921px]:top-[28%]");
    expect(messageField().parentElement?.className).not.toContain("bottom-[0.5lh]");
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
    expect(container!.textContent).not.toContain("따뜻한 연말 보내세요!");
    expect(container!.querySelector("article")).toBeNull();
    expect(container!.textContent).toContain("목록 보기");
    expect(container!.textContent).toContain("닫기");
    const actionButtons = Array.from(container!.querySelectorAll("button"));
    const listButton = actionButtons.find((button) => button.textContent?.includes("목록 보기"));
    const closeButton = actionButtons.find((button) => button.textContent?.includes("닫기"));
    expect(listButton?.className).toContain("w-24");
    expect(closeButton?.className).toContain("w-24");
    expect(listButton?.className).toContain("h-9");
    expect(closeButton?.className).toContain("h-9");
    expect(listButton?.querySelector("svg")?.getAttribute("class")).not.toContain(
      "absolute left-3",
    );
    expect(closeButton?.className).not.toContain("pl-10");
    expect(closeButton?.querySelector("svg")).toBeNull();
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
    const onClose = vi.fn();
    await render({ onSubmit: vi.fn().mockResolvedValue(undefined), onClose });
    await setMessage("행복한 겨울 보내요!");
    await submit();
    const closeButton = Array.from(container!.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("닫기"),
    );
    await act(async () => closeButton?.click());
    expect(onClose).toHaveBeenCalledOnce();
  });
});
