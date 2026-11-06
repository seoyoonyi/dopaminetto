import { ensureAnonymousSession } from "@/shared/lib/auth/ensureAnonymousSession";
import { AuthError, createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createChristmasCard } from "./createChristmasCard";

vi.mock("@/shared/lib/auth/ensureAnonymousSession", () => ({
  ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
}));

const user: User = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  app_metadata: { provider: "anonymous", providers: ["anonymous"] },
  user_metadata: { nickname: "눈사람" },
  created_at: "2026-11-04T00:00:00Z",
  is_anonymous: true,
};
const row = {
  id: 1,
  created_at: "2026-11-04T00:00:00Z",
  nickname: "카드이름",
  content: "메리 크리스마스",
  event_type: "christmas",
  user_id: user.id,
};

beforeEach(() => {
  vi.mocked(ensureAnonymousSession).mockReset().mockResolvedValue(undefined);
});

function setup(status = 201, response: unknown = row) {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(response), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const client = createClient("https://example.test", "test-key", {
    global: { fetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const getUser = vi
    .spyOn(client.auth, "getUser")
    .mockResolvedValue({ data: { user }, error: null });
  return { client, fetch, getUser };
}

describe("createChristmasCard", () => {
  it("현재 인증 UUID와 작성 시 수정한 이름·메시지를 저장하고 DB 반환 카드를 제공한다", async () => {
    const { client, fetch } = setup();
    await expect(
      createChristmasCard(client, "  카드이름  ", "  메리 크리스마스  "),
    ).resolves.toEqual(row);
    const [url, options] = fetch.mock.calls[0];
    expect(String(url)).toContain("/rest/v1/seasonal_cards?select=");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      nickname: "카드이름",
      content: "메리 크리스마스",
      event_type: "christmas",
      user_id: "00000000-0000-4000-8000-000000000001",
    });
  });

  it.each([
    { nickname: "가".repeat(11), message: "메리 크리스마스" },
    { nickname: "카드이름", message: "가".repeat(51) },
  ])(
    "UI에서 허용한 길이를 임의 절삭하지 않고 DB 정책 거부를 전달한다: $nickname",
    async ({ nickname, message }) => {
      const rejection = {
        code: "42501",
        message: "new row violates row-level security policy",
        details: null,
        hint: null,
      };
      const { client, fetch } = setup(403, rejection);
      await expect(createChristmasCard(client, nickname, message)).rejects.toMatchObject({
        code: "42501",
      });
      expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ nickname, content: message });
    },
  );

  it("익명 세션 준비 실패 시 저장 요청을 보내지 않는다", async () => {
    const { client, fetch } = setup();
    vi.mocked(ensureAnonymousSession).mockRejectedValueOnce(new Error("session failed"));
    await expect(createChristmasCard(client, "눈사람", "안녕하세요")).rejects.toThrow(
      "session failed",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("인증 사용자를 확인하지 못하면 임의 UUID로 저장하지 않는다", async () => {
    const { client, fetch, getUser } = setup();
    getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new AuthError("로그인 정보를 확인하지 못했어요.", 401),
    });
    await expect(createChristmasCard(client, "눈사람", "안녕하세요")).rejects.toThrow(
      "로그인 정보를 확인하지 못했어요.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { nickname: " ", message: "안녕" },
    { nickname: "가".repeat(13), message: "안녕" },
    { nickname: "눈사람", message: " " },
    { nickname: "눈사람", message: "가".repeat(181) },
  ])("UI 기준에도 유효하지 않은 입력은 저장하지 않는다", async ({ nickname, message }) => {
    const { client, fetch } = setup();
    await expect(createChristmasCard(client, nickname, message)).rejects.toThrow(
      "카드 작성 내용을 확인해 주세요.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
