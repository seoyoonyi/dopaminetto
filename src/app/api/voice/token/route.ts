// src/app/api/voice/token/route.ts
import { createSupabaseServerClient } from "@/shared/config/supabase.server";

import { NextResponse } from "next/server";

/** speaker용 Cloudflare Realtime Kit preset Name */
const SPEAKER_PRESET_NAME = "group_call_host";

/** listener용 Cloudflare Realtime Kit preset Name */
const LISTENER_PRESET_NAME = "group_call_participant";

/**
 * 음성 채널 참여를 위한 Cloudflare Realtime Kit 토큰을 발급한다.
 *
 * speaker는 오디오 track을 publish할 수 있는 preset으로 발급하고,
 * listener는 subscribe만 가능한 preset으로 발급한다.
 * 요청의 Bearer token을 Supabase에서 검증한 뒤,
 * 인증된 사용자의 app_metadata.role로 speaker 여부를 판정한다.
 * 클라이언트가 전달한 userId, nickname, isSpeaker는 권한 판정에 사용하지 않는다.
 */
export async function POST(req: Request) {
  try {
    const accessToken = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!accessToken) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const supabase = createSupabaseServerClient();

    if (!supabase) {
      return NextResponse.json({ error: "Supabase 환경변수가 누락되었습니다." }, { status: 500 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json({ error: "인증된 사용자를 확인할 수 없습니다." }, { status: 401 });
    }

    const nickname = user.user_metadata?.nickname;

    if (typeof nickname !== "string" || !nickname.trim()) {
      return NextResponse.json({ error: "닉네임이 필요합니다." }, { status: 400 });
    }

    const isSpeaker = user.app_metadata?.role === "speaker";
    const userId = user.id;

    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const appId = process.env.CLOUDFLARE_REALTIME_APP_ID;
    const meetingId = process.env.CLOUDFLARE_REALTIME_MEETING_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!accountId || !appId || !meetingId || !apiToken) {
      return NextResponse.json({ error: "Cloudflare 환경변수가 누락되었습니다." }, { status: 500 });
    }

    const presetName = isSpeaker ? SPEAKER_PRESET_NAME : LISTENER_PRESET_NAME;

    /** Cloudflare Realtime Kit 참여자 등록 API 호출 */
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/realtime/kit/${appId}/meetings/${meetingId}/participants`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          name: nickname,
          preset_name: presetName,
          custom_participant_id: userId,
        }),
        cache: "no-store",
      },
    );

    const result = await response.json();

    if (!response.ok || !result?.success) {
      return NextResponse.json(
        {
          error: "participant token 발급에 실패했습니다.",
        },
        { status: response.status || 500 },
      );
    }

    return NextResponse.json({
      token: result.data?.token,
      participantId: result.data?.id,
      role: isSpeaker ? "speaker" : "listener",
      presetName,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Unexpected server error",
      },
      { status: 500 },
    );
  }
}
