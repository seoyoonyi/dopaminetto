import { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureAnonymousSessionMock = vi.fn();

vi.mock("../auth/ensureAnonymousSession", () => ({
  ensureAnonymousSession: (...args: unknown[]) => ensureAnonymousSessionMock(...args),
}));

const createFakeSupabase = ({
  getSession,
  setAuth,
}: {
  getSession: ReturnType<typeof vi.fn>;
  setAuth?: ReturnType<typeof vi.fn>;
}) =>
  ({
    auth: { getSession },
    realtime: { setAuth: setAuth ?? vi.fn().mockResolvedValue(undefined) },
  }) as unknown as SupabaseClient;

describe("ensureFreshRealtimeAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("만료된 session → refresh 성공 → fresh token을 반환하고 realtime.setAuth에 그 토큰을 넘긴다", async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "fresh-token" } },
      error: null,
    });
    const setAuth = vi.fn().mockResolvedValue(undefined);
    const supabase = createFakeSupabase({ getSession, setAuth });

    const { ensureFreshRealtimeAuth } = await import("./realtimeAuthFreshness");
    const token = await ensureFreshRealtimeAuth(supabase);

    expect(token).toBe("fresh-token");
    expect(setAuth).toHaveBeenCalledWith("fresh-token");
  });

  it("realtime.setAuth()가 resolve되기 전까지 함수가 resolve되지 않는다 (호출부가 순서를 보장할 수 있다)", async () => {
    const trace: string[] = [];
    const getSession = vi.fn().mockImplementation(async () => {
      trace.push("getSession");
      return { data: { session: { access_token: "fresh-token" } }, error: null };
    });

    let resolveSetAuth: () => void = () => {};
    const setAuth = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSetAuth = () => {
            trace.push("setAuth-resolved");
            resolve();
          };
        }),
    );
    const supabase = createFakeSupabase({ getSession, setAuth });

    const { ensureFreshRealtimeAuth } = await import("./realtimeAuthFreshness");
    let settled = false;
    const promise = ensureFreshRealtimeAuth(supabase).then((token) => {
      settled = true;
      trace.push("ensureFreshRealtimeAuth-resolved");
      return token;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false); // setAuth가 아직 안 끝났으므로 호출부로 제어권이 넘어가면 안 된다

    resolveSetAuth();
    await promise;

    expect(trace).toEqual(["getSession", "setAuth-resolved", "ensureFreshRealtimeAuth-resolved"]);
  });

  it("session 정상 → 불필요한 ensureAnonymousSession(익명 로그인) 호출 없음", async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "existing-token" } },
      error: null,
    });
    const supabase = createFakeSupabase({ getSession });

    const { ensureFreshRealtimeAuth } = await import("./realtimeAuthFreshness");
    await ensureFreshRealtimeAuth(supabase);

    expect(ensureAnonymousSessionMock).not.toHaveBeenCalled();
  });

  it("session 없음 → 기존 익명 세션 복구 경로(ensureAnonymousSession)를 사용한다", async () => {
    const getSession = vi
      .fn()
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({
        data: { session: { access_token: "recovered-token" } },
        error: null,
      });
    ensureAnonymousSessionMock.mockResolvedValue(undefined);
    const supabase = createFakeSupabase({ getSession });

    const { ensureFreshRealtimeAuth } = await import("./realtimeAuthFreshness");
    const token = await ensureFreshRealtimeAuth(supabase);

    expect(ensureAnonymousSessionMock).toHaveBeenCalledWith(supabase);
    expect(token).toBe("recovered-token");
  });

  it("refresh 실패(getSession 예외) → 예외를 던지지 않고 null을 반환한다", async () => {
    const getSession = vi.fn().mockRejectedValue(new Error("network down"));
    const supabase = createFakeSupabase({ getSession });

    const { ensureFreshRealtimeAuth } = await import("./realtimeAuthFreshness");
    const token = await ensureFreshRealtimeAuth(supabase);

    expect(token).toBeNull();
  });

  it("refresh 실패(익명 세션 복구도 실패) → 예외를 던지지 않고 null을 반환한다", async () => {
    const getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    ensureAnonymousSessionMock.mockRejectedValue(new Error("익명 로그인에 실패했습니다"));
    const supabase = createFakeSupabase({ getSession });

    const { ensureFreshRealtimeAuth } = await import("./realtimeAuthFreshness");
    const token = await ensureFreshRealtimeAuth(supabase);

    expect(token).toBeNull();
  });
});

describe("ensureFreshRealtimeAuthOnce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("같은 client에 대한 동시 호출은 getSession을 한 번만 실행한다", async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: "token" } },
      error: null,
    });
    const supabase = createFakeSupabase({ getSession });

    const { ensureFreshRealtimeAuthOnce } = await import("./realtimeAuthFreshness");
    const [a, b] = await Promise.all([
      ensureFreshRealtimeAuthOnce(supabase),
      ensureFreshRealtimeAuthOnce(supabase),
    ]);

    expect(a).toBe("token");
    expect(b).toBe("token");
    expect(getSession).toHaveBeenCalledOnce();
  });

  it("서로 다른 client는 독립적으로 처리된다(교차 오염 없음)", async () => {
    const getSessionA = vi.fn().mockResolvedValue({
      data: { session: { access_token: "token-a" } },
      error: null,
    });
    const supabaseA = createFakeSupabase({ getSession: getSessionA });

    const getSessionB = vi.fn().mockResolvedValue({
      data: { session: { access_token: "token-b" } },
      error: null,
    });
    const supabaseB = createFakeSupabase({ getSession: getSessionB });

    const { ensureFreshRealtimeAuthOnce } = await import("./realtimeAuthFreshness");
    const [a, b] = await Promise.all([
      ensureFreshRealtimeAuthOnce(supabaseA),
      ensureFreshRealtimeAuthOnce(supabaseB),
    ]);

    expect(a).toBe("token-a");
    expect(b).toBe("token-b");
    expect(getSessionA).toHaveBeenCalledOnce();
    expect(getSessionB).toHaveBeenCalledOnce();
  });
});
