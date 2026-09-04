import { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { ensureAnonymousSession } from "./ensureAnonymousSession";

const createFakeSupabase = (overrides?: {
  getSession?: ReturnType<typeof vi.fn>;
  signInAnonymously?: ReturnType<typeof vi.fn>;
}) =>
  ({
    auth: {
      getSession: overrides?.getSession ?? vi.fn(),
      signInAnonymously: overrides?.signInAnonymously ?? vi.fn(),
    },
  }) as unknown as SupabaseClient;

describe("ensureAnonymousSession (client 인자 버전)", () => {
  it("기존 세션이 있으면 새 익명 사용자를 만들지 않고 유지한다", async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: { session: { user: { id: "existing-user" } } },
      error: null,
    });
    const signInAnonymously = vi.fn();
    const supabase = createFakeSupabase({ getSession, signInAnonymously });

    await ensureAnonymousSession(supabase);

    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("세션이 없으면 익명 사용자를 생성한다", async () => {
    const getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    const signInAnonymously = vi.fn().mockResolvedValue({ error: null });
    const supabase = createFakeSupabase({ getSession, signInAnonymously });

    await ensureAnonymousSession(supabase);

    expect(signInAnonymously).toHaveBeenCalledOnce();
  });

  it("전역 싱글턴이 아니라 전달받은 SupabaseClient 인스턴스를 그대로 사용한다", async () => {
    const getSessionA = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    const signInAnonymouslyA = vi.fn().mockResolvedValue({ error: null });
    const supabaseA = createFakeSupabase({
      getSession: getSessionA,
      signInAnonymously: signInAnonymouslyA,
    });

    const getSessionB = vi.fn().mockResolvedValue({
      data: { session: { user: { id: "b-user" } } },
      error: null,
    });
    const signInAnonymouslyB = vi.fn();
    const supabaseB = createFakeSupabase({
      getSession: getSessionB,
      signInAnonymously: signInAnonymouslyB,
    });

    await ensureAnonymousSession(supabaseA);
    await ensureAnonymousSession(supabaseB);

    expect(signInAnonymouslyA).toHaveBeenCalledOnce();
    expect(signInAnonymouslyB).not.toHaveBeenCalled();
  });

  it("세션 확인 오류를 그대로 전파한다", async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: { message: "network down" },
    });
    const supabase = createFakeSupabase({ getSession });

    await expect(ensureAnonymousSession(supabase)).rejects.toThrow("익명 세션 확인에 실패했습니다");
  });
});
