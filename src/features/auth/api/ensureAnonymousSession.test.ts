import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const signInAnonymouslyMock = vi.fn();

vi.mock("@/shared/config/supabase.client", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      signInAnonymously: signInAnonymouslyMock,
    },
  },
}));

describe("ensureAnonymousSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the existing session without creating a new anonymous user", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: "existing-user" } } },
      error: null,
    });

    const { ensureAnonymousSession } = await import("./ensureAnonymousSession");

    await ensureAnonymousSession();

    expect(signInAnonymouslyMock).not.toHaveBeenCalled();
  });

  it("creates an anonymous user when no session exists", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    signInAnonymouslyMock.mockResolvedValue({ error: null });

    const { ensureAnonymousSession } = await import("./ensureAnonymousSession");

    await ensureAnonymousSession();

    expect(signInAnonymouslyMock).toHaveBeenCalledOnce();
  });
});
