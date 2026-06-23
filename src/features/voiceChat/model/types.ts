/** 음성 채널 참여자 역할 */
export type VoiceRole = "speaker" | "listener";

/** 음성 토큰 발급 요청 파라미터 */
export type RequestVoiceTokenParams = {
  userId: string;
  nickname: string;
  isSpeaker?: boolean;
};

/** 음성 토큰 발급 응답 */
export type RequestVoiceTokenResponse = {
  token: string;
  participantId: string;
  role: VoiceRole;
  presetName: string;
};
