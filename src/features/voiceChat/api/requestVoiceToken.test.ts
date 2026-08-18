import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestVoiceToken } from "./requestVoiceToken";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));
const fetchMock = vi.fn();

vi.mock("@/shared/config/supabase.client", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

describe("requestVoiceToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "token",
          participantId: "participant-id",
          role: "listener",
          presetName: "group_call_participant",
          speakerAccessDenied: false,
        }),
        { status: 200 },
      ),
    );
  });

  it("sends the Supabase access token without trusting client identity fields", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
      error: null,
    });

    await requestVoiceToken();

    expect(fetchMock).toHaveBeenCalledWith("/api/voice/token", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
      },
    });
  });

  it("does not request a voice token without an authenticated session", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(requestVoiceToken()).rejects.toThrow("인증 세션이 없습니다.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
