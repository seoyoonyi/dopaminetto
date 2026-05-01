"use client";

import { useTownPanelToggleStore } from "@/features/panelToggle";
import { PresenceToolbarButton } from "@/features/presence";

interface TownToolbarProps {
  isSpeaker: boolean;
}

export function TownToolbar({ isSpeaker }: TownToolbarProps) {
  const activePanel = useTownPanelToggleStore((state) => state.activePanel);
  const togglePanel = useTownPanelToggleStore((state) => state.togglePanel);
  const isUsersPanel = activePanel === "users";

  return (
    <div className="flex h-12 w-full items-center justify-end  border-t bg-white px-4">
      <PresenceToolbarButton
        isSpeaker={isSpeaker}
        isUsersPanel={isUsersPanel}
        onToggle={togglePanel}
      />
    </div>
  );
}

export default TownToolbar;
