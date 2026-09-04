import type { VoiceRole } from "./types";

interface ResolveVoiceAccessParams {
  hasSpeakerPermission: boolean;
  nickname: string;
  speakerNickname: string;
}

interface VoiceAccess {
  role: VoiceRole;
  speakerAccessDenied: boolean;
}

export function resolveVoiceAccess({
  hasSpeakerPermission,
  nickname,
  speakerNickname,
}: ResolveVoiceAccessParams): VoiceAccess {
  const requestedSpeaker = nickname.trim() === speakerNickname.trim();
  const isSpeaker = hasSpeakerPermission && requestedSpeaker;

  return {
    role: isSpeaker ? "speaker" : "listener",
    speakerAccessDenied: requestedSpeaker && !hasSpeakerPermission,
  };
}
