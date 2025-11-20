"use client";

import { useTownPanelToggleStore } from "@/features/panelToggle";
import { PresenceToolbarButton } from "@/features/presence";

export function TownToolbar() {
  const activePanel = useTownPanelToggleStore((state) => state.activePanel);
  const togglePanel = useTownPanelToggleStore((state) => state.togglePanel);
  const isUsersPanel = activePanel === "users";

  return (
    <div className="flex h-12 w-full items-center justify-end  border-t bg-white px-4">
      <PresenceToolbarButton isUsersPanel={isUsersPanel} onToggle={togglePanel} />
    </div>
  );
}

export default TownToolbar;
