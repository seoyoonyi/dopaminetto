/** 음성 채널 참여자 역할 */
export type VoiceRole = "speaker" | "listener";

/** 음성 토큰 발급 응답 */
export type RequestVoiceTokenResponse = {
  token: string;
  participantId: string;
  /** 서버에서 인증 사용자 권한을 기준으로 확정한 음성 역할 */
  role: VoiceRole;
  presetName: string;
};
