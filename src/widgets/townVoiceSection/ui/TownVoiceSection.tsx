"use client";

import { useTownPresenceStore } from "@/features/presence/model/useTownPresenceStore";
import { TownVoiceClient } from "@/features/voiceChat";
import type { VoiceRole } from "@/features/voiceChat";

interface TownVoiceSectionProps {
  userNickname: string;
  voiceRole: VoiceRole | null;
  onRoleChange: (role: VoiceRole | null) => void;
}

export function TownVoiceSection({ userNickname, voiceRole, onRoleChange }: TownVoiceSectionProps) {
  const setVoiceConnected = useTownPresenceStore((state) => state.setVoiceConnected);
  const setAudioEnabled = useTownPresenceStore((state) => state.setAudioEnabled);
  const setAudioController = useTownPresenceStore((state) => state.setAudioController);
  const setListeningController = useTownPresenceStore((state) => state.setListeningController);
  const setListeningEnabled = useTownPresenceStore((state) => state.setListeningEnabled);
  const setAudioToggling = useTownPresenceStore((state) => state.setAudioToggling);

  return (
    <TownVoiceClient
      nickname={userNickname}
      voiceRole={voiceRole}
      onRoleChange={onRoleChange}
      onConnectionChange={setVoiceConnected}
      onAudioEnabledChange={setAudioEnabled}
      onAudioControllerChange={setAudioController}
      onAudioTogglingChange={setAudioToggling}
      onListeningControllerChange={setListeningController}
      onListeningEnabledChange={setListeningEnabled}
    />
  );
}
