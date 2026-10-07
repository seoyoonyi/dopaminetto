// @vitest-environment jsdom
import { useNicknameDialogStore } from "@/shared/store/useNicknameDialogStore";
import { useUserStore } from "@/shared/store/useUserStore";
import type { User } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";

import { NicknameChangeButton } from "./NicknameChangeButton";

const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock("@/shared/config/supabase.client", () => ({ supabase: { auth: { updateUser } } }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user = {
  id: "auth-user",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: { nickname: "기존이름", characterId: "p-girl" },
  created_at: "2026-09-28T00:00:00Z",
} satisfies User;

let root: Root;
let container: HTMLDivElement;
let queryClient: QueryClient;

const button = (name: string) => {
  const found = Array.from(document.querySelectorAll("button")).find(
    (element) => element.textContent === name || element.getAttribute("aria-label") === name,
  );
  if (!found) throw new Error(`Button not found: ${name}`);
  return found;
};
const dialog = () => document.querySelector('[role="dialog"]');
const input = () => document.querySelector<HTMLInputElement>("#town-nickname")!;
const click = async (name: string) => act(async () => button(name).click());
const fill = async (value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const settle = async () => act(async () => new Promise((resolve) => setTimeout(resolve, 10)));

beforeEach(async () => {
  updateUser.mockReset();
  localStorage.clear();
  useNicknameDialogStore.setState({ isOpen: false });
  useUserStore.setState({
    userId: "player-user",
    userNickname: "기존이름",
    selectedCharacterId: "p-girl",
  });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData(["userInfo"], user);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <NicknameChangeButton townConnectionStatus="connected" />
      </QueryClientProvider>,
    ),
  );
});

afterEach(async () => {
  await act(async () => root.unmount());
  queryClient.clear();
  container.remove();
});

describe("타운 닉네임 변경", () => {
  it("긴 한글 닉네임은 좁은 화면 프로필 너비 안에서 말줄임한다", async () => {
    const longNickname = "QA_ㅇㅇ머지확인";
    await act(async () => useUserStore.setState({ userNickname: longNickname }));
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <NicknameChangeButton townConnectionStatus="connected" />
        </QueryClientProvider>,
      ),
    );

    const trigger = container.querySelector<HTMLButtonElement>(
      `button[aria-label="${longNickname}, 닉네임 변경"]`,
    );
    const profile = trigger?.parentElement?.parentElement;

    expect(trigger?.querySelector("span")?.classList.contains("truncate")).toBe(true);
    expect(trigger?.getAttribute("aria-label")).toBe(`${longNickname}, 닉네임 변경`);
    expect(profile?.className).toContain("max-w-40");
    expect(profile?.className).toContain("sm:max-w-64");
  });

  it("이름 아래에 타운 연결 상태를 세 색과 문구로 표시한다", async () => {
    const status = () => container.querySelector<HTMLElement>('[role="status"]')!;

    expect(status().textContent).toContain("연결됨");
    expect(status().querySelector(".bg-emerald-500")).not.toBeNull();

    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <NicknameChangeButton townConnectionStatus="connecting" />
        </QueryClientProvider>,
      ),
    );
    expect(status().textContent).toContain("연결 중");
    expect(status().querySelector(".bg-amber-400")).not.toBeNull();

    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <NicknameChangeButton townConnectionStatus="disconnected" />
        </QueryClientProvider>,
      ),
    );
    expect(status().textContent).toContain("연결 안됨");
    expect(status().querySelector(".bg-red-500")).not.toBeNull();
  });

  it("서버 저장 성공 후 이름과 재입장 저장값을 갱신하고 ID·캐릭터를 유지한다", async () => {
    const updatedUser = { ...user, user_metadata: { ...user.user_metadata, nickname: "새이름" } };
    updateUser.mockResolvedValue({ data: { user: updatedUser }, error: null });
    await click("기존이름, 닉네임 변경");
    expect(input().value).toBe("기존이름");
    expect(button("저장").disabled).toBe(true);
    await fill("새이름");
    await click("저장");
    await settle();

    expect(updateUser).toHaveBeenCalledWith({ data: { nickname: "새이름" } });
    expect(queryClient.getQueryData(["userInfo"])).toEqual(updatedUser);
    expect(useUserStore.getState()).toMatchObject({
      userId: "player-user",
      userNickname: "새이름",
      selectedCharacterId: "p-girl",
    });
    expect(JSON.parse(localStorage.getItem("user-storage")!).state.userNickname).toBe("새이름");
    expect(dialog()).toBeNull();
    expect(button("새이름, 닉네임 변경")).toBeDefined();
    expect(useNicknameDialogStore.getState().isOpen).toBe(false);
  });

  it("실패하면 기존 이름을 유지하며 입력값을 남겨 재시도할 수 있다", async () => {
    updateUser.mockResolvedValue({ data: { user: null }, error: new Error("network") });
    await click("기존이름, 닉네임 변경");
    await fill("재시도이름");
    await click("저장");
    await settle();

    expect(dialog()).not.toBeNull();
    expect(input().value).toBe("재시도이름");
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("다시 시도");
    expect(useUserStore.getState().userNickname).toBe("기존이름");
    expect(queryClient.getQueryData(["userInfo"])).toEqual(user);
    expect(JSON.parse(localStorage.getItem("user-storage")!).state.userNickname).toBe("기존이름");
    expect(button("저장").disabled).toBe(false);
  });

  it("취소한 초안은 다시 열 때 복원하지 않고 이동 차단 상태도 해제한다", async () => {
    await click("기존이름, 닉네임 변경");
    expect(useNicknameDialogStore.getState().isOpen).toBe(true);
    await fill("취소할이름");
    await click("취소");
    expect(useNicknameDialogStore.getState().isOpen).toBe(false);
    await click("기존이름, 닉네임 변경");
    expect(input().value).toBe("기존이름");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("공백과 12자를 초과하는 입력은 저장할 수 없다", async () => {
    await click("기존이름, 닉네임 변경");
    await fill("   ");
    expect(button("저장").disabled).toBe(true);
    await fill("1234567890123");
    expect(button("저장").disabled).toBe(true);
    await fill("123456789012");
    expect(button("저장").disabled).toBe(false);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("입력 중 닉네임 글자 수를 최대 12자와 함께 보여준다", async () => {
    await click("기존이름, 닉네임 변경");
    const hint = document.querySelector("#town-nickname-hint")!;
    expect(hint.textContent).toBe("4/12");
    expect(hint.textContent).not.toContain("공백만 입력할 수 없으며");

    await fill("12345678901");
    expect(hint.textContent).toBe("11/12");

    await fill("123456789012");
    expect(hint.textContent).toBe("12/12");
  });

  it("저장 중에는 중복 제출과 닫기를 막고 성공 후 닫는다", async () => {
    let resolveUpdate!: (value: unknown) => void;
    updateUser.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    await click("기존이름, 닉네임 변경");
    await fill("새이름");
    await act(async () => {
      const form = document.querySelector("form")!;
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await settle();
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(button("저장 중...").disabled).toBe(true);
    expect(button("취소").disabled).toBe(true);
    await act(async () =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      ),
    );
    expect(dialog()).not.toBeNull();
    await act(async () =>
      resolveUpdate({
        data: { user: { ...user, user_metadata: { ...user.user_metadata, nickname: "새이름" } } },
        error: null,
      }),
    );
    await settle();
    expect(dialog()).toBeNull();
  });
});
