import { createSupabaseServerClient } from "@/shared/config/supabase.server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const getUserMock = vi.fn();
const cloudflareFetchMock = vi.fn();

vi.mock("@/shared/config/supabase.server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

const createRequest = (body: Record<string, unknown> = {}) =>
  new Request("http://localhost/api/voice/token", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-access-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

const cloudflareResponse = () =>
  new Response(
    JSON.stringify({
      success: true,
      data: { token: "token", id: "participant-id" },
    }),
    { status: 200 },
  );

describe("POST /api/voice/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-id");
    vi.stubEnv("CLOUDFLARE_REALTIME_APP_ID", "app-id");
    vi.stubEnv("CLOUDFLARE_REALTIME_MEETING_ID", "meeting-id");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "api-token");
    vi.stubEnv("NEXT_PUBLIC_SPEAKER_NICKNAME", "방송자");
    vi.mocked(createSupabaseServerClient).mockReturnValue({
      auth: { getUser: getUserMock },
    } as never);
    vi.stubGlobal("fetch", cloudflareFetchMock);
    cloudflareFetchMock.mockImplementation(() => Promise.resolve(cloudflareResponse()));
  });

  it("rejects requests without an authenticated Supabase user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new Error("unauthorized") });

    const response = await POST(
      new Request("http://localhost/api/voice/token", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(cloudflareFetchMock).not.toHaveBeenCalled();
  });

  it("always issues the listener preset to a regular user despite isSpeaker input", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "verified-user-id",
          user_metadata: { nickname: "일반 사용자" },
          app_metadata: {},
        },
      },
      error: null,
    });

    const response = await POST(
      createRequest({
        userId: "forged-user-id",
        nickname: "조작된 닉네임",
        isSpeaker: true,
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      role: "listener",
      presetName: "group_call_participant",
      speakerAccessDenied: false,
    });
    expect(cloudflareFetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          name: "일반 사용자",
          preset_name: "group_call_participant",
          custom_participant_id: "verified-user-id",
        }),
      }),
    );
  });

  it("issues the speaker preset only to a user with the speaker app metadata role", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "speaker-user-id",
          user_metadata: { nickname: "방송자" },
          app_metadata: { role: "speaker" },
        },
      },
      error: null,
    });

    const response = await POST(createRequest({ isSpeaker: false }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      role: "speaker",
      presetName: "group_call_host",
      speakerAccessDenied: false,
    });
  });

  it("issues the listener preset to an authorized speaker using a regular nickname", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "speaker-user-id",
          user_metadata: { nickname: "일반 사용자" },
          app_metadata: { role: "speaker" },
        },
      },
      error: null,
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      role: "listener",
      presetName: "group_call_participant",
      speakerAccessDenied: false,
    });
  });

  it("preserves UID speaker permission across nickname-based role transitions", async () => {
    const speakerPermission = { role: "speaker" };
    const user = {
      id: "speaker-user-id",
      user_metadata: { nickname: "방송자" },
      app_metadata: speakerPermission,
    };

    getUserMock
      .mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({
        data: {
          user: { ...user, user_metadata: { nickname: "일반 사용자" } },
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { user }, error: null });

    const firstResponse = await POST(createRequest());
    const secondResponse = await POST(createRequest());
    const thirdResponse = await POST(createRequest());

    expect(await firstResponse.json()).toMatchObject({
      role: "speaker",
      presetName: "group_call_host",
    });
    expect(await secondResponse.json()).toMatchObject({
      role: "listener",
      presetName: "group_call_participant",
    });
    expect(await thirdResponse.json()).toMatchObject({
      role: "speaker",
      presetName: "group_call_host",
    });
    expect(user.app_metadata).toEqual(speakerPermission);
  });

  it("marks speaker access denied for a regular user using the speaker nickname", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "regular-user-id",
          user_metadata: { nickname: " 방송자 " },
          app_metadata: {},
        },
      },
      error: null,
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      role: "listener",
      presetName: "group_call_participant",
      speakerAccessDenied: true,
    });
  });

  it("rejects token requests when the speaker nickname setting is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SPEAKER_NICKNAME", "");
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "regular-user-id",
          user_metadata: { nickname: "일반 사용자" },
          app_metadata: {},
        },
      },
      error: null,
    });

    const response = await POST(createRequest());

    expect(response.status).toBe(500);
    expect(cloudflareFetchMock).not.toHaveBeenCalled();
  });
});
