"use client";

import { useTownPresenceStore } from "@/features/presence/model/useTownPresenceStore";
import { TownVoiceClient } from "@/features/voice-chat";

import { useEffect } from "react";

interface TownVoiceSectionProps {
  userId: string;
  userNickname: string;
}

export function TownVoiceSection({ userId, userNickname }: TownVoiceSectionProps) {
  const isSpeaker = userNickname === process.env.NEXT_PUBLIC_SPEAKER_NICKNAME;
  const setVoiceConnected = useTownPresenceStore((state) => state.setVoiceConnected);
  const setIsSpeaker = useTownPresenceStore((state) => state.setIsSpeaker);
  const setAudioEnabled = useTownPresenceStore((state) => state.setAudioEnabled);
  const setAudioController = useTownPresenceStore((state) => state.setAudioController);
  const setListeningController = useTownPresenceStore((state) => state.setListeningController);
  const setListeningEnabled = useTownPresenceStore((state) => state.setListeningEnabled);
  const setAudioToggling = useTownPresenceStore((state) => state.setAudioToggling);

  /** 툴바와 사용자 패널이 현재 사용자의 역할 정보를 공통 store에서 읽도록 맞춘다. */
  useEffect(() => {
    setIsSpeaker(isSpeaker);
  }, [isSpeaker, setIsSpeaker]);

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
