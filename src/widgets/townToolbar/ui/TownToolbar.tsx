"use client";

import { useTownPanelToggleStore } from "@/features/panelToggle";
import { PresenceToolbarButton } from "@/features/presence";

interface TownToolbarProps {
  isSpeaker: boolean;
  leadingSlot?: React.ReactNode;
  /**
   * 툴바 오른쪽 끝(presence/voice 컨트롤 뒤)에 배치되는 optional 영역. 조합은 상위(app) layer에서 한다.
   */
  trailingSlot?: React.ReactNode;
}

export function TownToolbar({ isSpeaker, leadingSlot, trailingSlot }: TownToolbarProps) {
  const activePanel = useTownPanelToggleStore((state) => state.activePanel);
  const togglePanel = useTownPanelToggleStore((state) => state.togglePanel);
  const isUsersPanel = activePanel === "users";
  return (
    <div className="flex h-16 w-full items-center gap-2 border-t bg-white px-2 sm:px-4">
      {leadingSlot ? (
        <>
          <div aria-label="내 타운 상태" className="flex shrink-0 items-center gap-2">
            <div className="min-w-0">{leadingSlot}</div>
          </div>
          <span aria-hidden className="mx-1.5 h-6 w-px shrink-0 bg-gray-200" />
        </>
      ) : null}
      <span className="shrink-0 whitespace-nowrap text-[13px] font-normal text-muted-foreground">
        {isSpeaker ? "방송자" : "청취자"}
      </span>
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
