"use client";

import { useTownPanelToggleStore } from "@/features/panelToggle";
import { PresenceToolbarButton } from "@/features/presence";
import { useTownPresenceStore } from "@/features/presence/model/useTownPresenceStore";

export function TownToolbar() {
  const activePanel = useTownPanelToggleStore((state) => state.activePanel);
  const togglePanel = useTownPanelToggleStore((state) => state.togglePanel);
  const isConnected = useTownPresenceStore((state) => state.isConnected);
  const isUsersPanel = activePanel === "users";
  const connectionLabel = isConnected ? "연결됨" : "연결 중...";

  return (
    <div className="flex h-12 w-full items-center justify-between border-t bg-white px-4">
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${
            isConnected ? "bg-emerald-500" : "bg-amber-400 animate-pulse"
          }`}
        />
        <span>{connectionLabel}</span>
      </div>
      <PresenceToolbarButton isUsersPanel={isUsersPanel} onToggle={togglePanel} />
    </div>
  );
}

export default TownToolbar;
