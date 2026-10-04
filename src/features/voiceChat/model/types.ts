/** 음성 채널 참여자 역할 */
export type VoiceRole = "speaker" | "listener";

/** 사용자에게 표시할 음성 채널 연결 상태 */
export type VoiceConnectionStatus = "idle" | "connecting" | "connected" | "error";

/** 음성 토큰 발급 응답 */
export type RequestVoiceTokenResponse = {
  token: string;
  participantId: string;
  /** 서버가 UID 권한과 현재 닉네임을 함께 검증해 확정한 음성 역할 */
  role: VoiceRole;
  presetName: string;
  /** speaker 닉네임을 요청했지만 UID 권한이 없어 listener로 입장했는지 여부 */
  speakerAccessDenied: boolean;
};
