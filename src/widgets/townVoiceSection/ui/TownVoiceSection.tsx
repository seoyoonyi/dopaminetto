"use client";

import { useTownPresenceStore } from "@/features/presence/model/useTownPresenceStore";
import { TownVoiceClient } from "@/features/voiceChat";

interface TownVoiceSectionProps {
  userId: string;
  userNickname: string;
  isSpeaker: boolean;
}

export function TownVoiceSection({ userId, userNickname, isSpeaker }: TownVoiceSectionProps) {
  const setVoiceConnected = useTownPresenceStore((state) => state.setVoiceConnected);
  const setAudioEnabled = useTownPresenceStore((state) => state.setAudioEnabled);
  const setAudioController = useTownPresenceStore((state) => state.setAudioController);
  const setListeningController = useTownPresenceStore((state) => state.setListeningController);
  const setListeningEnabled = useTownPresenceStore((state) => state.setListeningEnabled);
  const setAudioToggling = useTownPresenceStore((state) => state.setAudioToggling);

  return (
    <TownVoiceClient
      userId={userId}
      nickname={userNickname}
      isSpeaker={isSpeaker}
      onConnectionChange={setVoiceConnected}
      onAudioEnabledChange={setAudioEnabled}
      onAudioControllerChange={setAudioController}
      onAudioTogglingChange={setAudioToggling}
      onListeningControllerChange={setListeningController}
      onListeningEnabledChange={setListeningEnabled}
    />
  );
}
