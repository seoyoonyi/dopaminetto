"use client";

import { useTownPresenceStore } from "../model/useTownPresenceStore";
import { UsersPanelToggleButton } from "./UsersPanelToggleButton";
import { VoiceControlGroup } from "./VoiceControlGroup";

interface PresenceToolbarButtonProps {
  onToggle?: () => void;
  isUsersPanel?: boolean;
}

export const PresenceToolbarButton = ({
  onToggle,
  isUsersPanel = false,
}: PresenceToolbarButtonProps) => {
  const participantCount = useTownPresenceStore((state) => state.participants.length);
  const isConnected = useTownPresenceStore((state) => state.isConnected);
  const voiceConnected = useTownPresenceStore((state) => state.voiceConnected);
  const isSpeaker = useTownPresenceStore((state) => state.isSpeaker);

  const canToggleAudio = useTownPresenceStore((state) => state.canToggleAudio);
  const toggleLocalAudio = useTownPresenceStore((state) => state.toggleLocalAudio);
  const audioEnabled = useTownPresenceStore((state) => state.audioEnabled);
  const isAudioToggling = useTownPresenceStore((state) => state.isAudioToggling);

  const canToggleListening = useTownPresenceStore((state) => state.canToggleListening);
  const toggleLocalListening = useTownPresenceStore((state) => state.toggleLocalListening);
  const listeningEnabled = useTownPresenceStore((state) => state.listeningEnabled);

  return (
    <div className="flex items-center w-full justify-end gap-2">
      <VoiceControlGroup
        isSpeaker={isSpeaker}
        voiceConnected={voiceConnected}
        canToggleAudio={canToggleAudio}
        toggleLocalAudio={toggleLocalAudio}
        audioEnabled={audioEnabled}
        isAudioToggling={isAudioToggling}
        canToggleListening={canToggleListening}
        toggleLocalListening={toggleLocalListening}
        listeningEnabled={listeningEnabled}
      />
      <UsersPanelToggleButton
        participantCount={participantCount}
        isConnected={isConnected}
        isUsersPanel={isUsersPanel}
        onToggle={onToggle}
      />
    </div>
  );
};
