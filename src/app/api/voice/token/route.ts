// src/app/api/voice/token/route.ts
import { NextResponse } from "next/server";

/** speaker용 Cloudflare Realtime Kit preset Name */
const SPEAKER_PRESET_NAME = "group_call_host";

/** listener용 Cloudflare Realtime Kit preset Name */
const LISTENER_PRESET_NAME = "group_call_participant";

/** 음성 토큰 발급 요청 바디 */
type VoiceTokenRequest = {
  userId: string;
  nickname: string;
  isSpeaker?: boolean;
};

/**
 * 음성 채널 참여를 위한 Cloudflare Realtime Kit 토큰을 발급한다.
 *
 * speaker는 오디오 track을 publish할 수 있는 preset으로 발급하고,
 * listener는 subscribe만 가능한 preset으로 발급한다.
 *
 * TODO: 현재 isSpeaker를 클라이언트 요청값 그대로 사용하고 있다.
 * 프로덕션에서는 서버 측에서 speaker 권한을 검증해야 한다.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VoiceTokenRequest;
    const { userId, nickname, isSpeaker = false } = body;

    if (!userId || !nickname) {
      return NextResponse.json({ error: "userId와 nickname은 필수입니다." }, { status: 400 });
    }

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
          detail: result,
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
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected server error",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
