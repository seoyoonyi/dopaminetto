import { RequestVoiceTokenParams, RequestVoiceTokenResponse } from "../model/types";

/**
 * 음성 채널 참여를 위한 토큰을 서버에 요청한다.
 *
 * /api/voice/token 엔드포인트를 호출하여
 * Cloudflare Realtime Kit 연결에 필요한 토큰과 참여자 정보를 반환받는다.
 */
export async function requestVoiceToken(
  params: RequestVoiceTokenParams,
): Promise<RequestVoiceTokenResponse> {
  const response = await fetch("/api/voice/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.error ?? "음성 토큰 발급에 실패했습니다.");
  }

  return result;
}
