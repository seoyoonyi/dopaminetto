"use client";

import { useListeningVolumeStore } from "../model/useListeningVolumeStore";
import { useTownPresenceStore } from "../model/useTownPresenceStore";
import { UsersPanelToggleButton } from "./UsersPanelToggleButton";
import { VoiceControlGroup } from "./VoiceControlGroup";

interface PresenceToolbarButtonProps {
  isSpeaker: boolean;
  onToggle?: () => void;
  isUsersPanel?: boolean;
}

export const PresenceToolbarButton = ({
  isSpeaker,
  onToggle,
  isUsersPanel = false,
}: PresenceToolbarButtonProps) => {
  const participantCount = useTownPresenceStore((state) => state.participants.length);
  const isConnected = useTownPresenceStore((state) => state.isConnected);
  const voiceConnected = useTownPresenceStore((state) => state.voiceConnected);

  const canToggleAudio = useTownPresenceStore((state) => state.canToggleAudio);
  const toggleLocalAudio = useTownPresenceStore((state) => state.toggleLocalAudio);
  const audioEnabled = useTownPresenceStore((state) => state.audioEnabled);
  const isAudioToggling = useTownPresenceStore((state) => state.isAudioToggling);

  const listeningVolume = useListeningVolumeStore((state) => state.listeningVolume);
  const lastAudibleListeningVolume = useListeningVolumeStore(
    (state) => state.lastAudibleListeningVolume,
  );
  const setListeningVolume = useListeningVolumeStore((state) => state.setListeningVolume);

  return (
    <div className="flex items-center w-full justify-end gap-2">
      <VoiceControlGroup
        isSpeaker={isSpeaker}
        voiceConnected={voiceConnected}
        canToggleAudio={canToggleAudio}
        toggleLocalAudio={toggleLocalAudio}
        audioEnabled={audioEnabled}
        isAudioToggling={isAudioToggling}
        listeningVolume={listeningVolume}
        lastAudibleListeningVolume={lastAudibleListeningVolume}
        setListeningVolume={setListeningVolume}
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
