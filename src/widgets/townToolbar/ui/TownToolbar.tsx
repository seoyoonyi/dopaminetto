"use client";

import { useTownPanelToggleStore } from "@/features/panelToggle";
import { PresenceToolbarButton } from "@/features/presence";

interface TownToolbarProps {
  isSpeaker: boolean;
  /**
   * 툴바 오른쪽 끝(presence/voice 컨트롤 뒤)에 배치되는 optional 영역. 조합은 상위(app) layer에서 한다.
   * 왼쪽 하단은 dev 환경의 React Query Devtools 버튼과 겹치므로 오른쪽에 둔다.
   */
  trailingSlot?: React.ReactNode;
}

export function TownToolbar({ isSpeaker, trailingSlot }: TownToolbarProps) {
  const activePanel = useTownPanelToggleStore((state) => state.activePanel);
  const togglePanel = useTownPanelToggleStore((state) => state.togglePanel);
  const isUsersPanel = activePanel === "users";

  return (
    <div className="flex h-12 w-full items-center justify-end gap-2 border-t bg-white px-4">
      <PresenceToolbarButton
        isSpeaker={isSpeaker}
        isUsersPanel={isUsersPanel}
        onToggle={togglePanel}
      />
      {trailingSlot}
    </div>
  );
}

export default TownToolbar;
