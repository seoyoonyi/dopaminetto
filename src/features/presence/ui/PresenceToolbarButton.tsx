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
  const canToggleAudio = useTownPresenceStore((state) => state.canToggleAudio);
  const toggleLocalAudio = useTownPresenceStore((state) => state.toggleLocalAudio);
  const audioEnabled = useTownPresenceStore((state) => state.audioEnabled);
  const isAudioToggling = useTownPresenceStore((state) => state.isAudioToggling);
  const voiceConnectionStatus = useTownPresenceStore((state) => state.voiceConnectionStatus);

  const listeningVolume = useListeningVolumeStore((state) => state.listeningVolume);
  const lastAudibleListeningVolume = useListeningVolumeStore(
    (state) => state.lastAudibleListeningVolume,
  );
  const setListeningVolume = useListeningVolumeStore((state) => state.setListeningVolume);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {voiceConnectionStatus === "connected" ? (
        <VoiceControlGroup
          isSpeaker={isSpeaker}
          canToggleAudio={canToggleAudio}
          toggleLocalAudio={toggleLocalAudio}
          audioEnabled={audioEnabled}
          isAudioToggling={isAudioToggling}
          listeningVolume={listeningVolume}
          lastAudibleListeningVolume={lastAudibleListeningVolume}
          setListeningVolume={setListeningVolume}
        />
      ) : (
        <span
          role="status"
          className={`shrink-0 whitespace-nowrap text-[13px] font-normal ${
            voiceConnectionStatus === "error" ? "text-red-600" : "text-muted-foreground"
          }`}
        >
          {voiceConnectionStatus === "connecting"
            ? "음성 연결 중…"
            : voiceConnectionStatus === "error"
              ? "음성 연결 실패"
              : "음성 연결 대기"}
        </span>
      )}
      <div className="ml-auto w-16 shrink-0 sm:w-auto">
        <UsersPanelToggleButton
          participantCount={participantCount}
          isUsersPanel={isUsersPanel}
          onToggle={onToggle}
        />
      </div>
    </div>
  );
};
