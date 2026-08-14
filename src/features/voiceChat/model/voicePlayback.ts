export const shouldMuteVoicePlayback = (isSpeaker: boolean, isListeningEnabled: boolean) =>
  !isSpeaker && !isListeningEnabled;
