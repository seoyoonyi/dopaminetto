import type { VoiceRole } from "./types";

export interface VoicePermissions {
  isSpeaker: boolean;
  canUseMic: boolean;
  canListen: boolean;
}

/** 서버에서 확정된 음성 역할과 닉네임 상태를 UI·SDK 권한으로 변환한다. */
export function resolveVoicePermissions(
  role: VoiceRole | null,
  hasNickname: boolean,
): VoicePermissions {
  const isSpeaker = role === "speaker";

  return {
    isSpeaker,
    canUseMic: isSpeaker && hasNickname,
    canListen: !isSpeaker,
  };
}
