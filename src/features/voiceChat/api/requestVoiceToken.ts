import { supabase } from "@/shared/config/supabase.client";

import { RequestVoiceTokenResponse } from "../model/types";

/**
 * 음성 채널 참여를 위한 토큰을 서버에 요청한다.
 *
 * /api/voice/token 엔드포인트를 호출하여
 * Cloudflare Realtime Kit 연결에 필요한 토큰과 참여자 정보를 반환받는다.
 * 현재 Supabase 세션의 access token을 Authorization 헤더로 전달하며,
 * 사용자 ID·닉네임·음성 역할은 요청 본문으로 전달하지 않는다.
 * 인증 세션이 없으면 서버 요청을 보내지 않고 오류를 반환한다.
 */
export async function requestVoiceToken(): Promise<RequestVoiceTokenResponse> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(`인증 세션 확인에 실패했습니다: ${sessionError.message}`);
  }

  if (!session?.access_token) {
    throw new Error("인증 세션이 없습니다.");
  }

  const response = await fetch("/api/voice/token", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.error ?? "음성 토큰 발급에 실패했습니다.");
  }

  return result;
}
