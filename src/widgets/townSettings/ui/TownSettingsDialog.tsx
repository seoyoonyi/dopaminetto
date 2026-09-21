"use client";

import { AmbientSoundSettings } from "@/features/ambientSound";
import { PresenceNotificationSettings } from "@/features/presence";
import { cn } from "@/lib/utils";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

import { useState } from "react";

/**
 * 설정 모달의 content shell.
 *
 * - `Dialog` root는 만들지 않는다. 상위(`TownSettingsButton`)의 `Dialog` context 안에서
 *   `DialogContent` 이하만 렌더한다.
 * - 데스크톱 2열 구조다. 왼쪽은 설정 카테고리 메뉴, 오른쪽은 선택한 카테고리의 내용이다.
 * - 현재 카테고리는 Dialog 안의 local state로 관리한다.
 * - feature별 설정 UI를 조합하고 세부 상태 관리는 각 feature에 맡긴다.
 */
export function TownSettingsDialog() {
  const [activeCategory, setActiveCategory] = useState<"sound" | "notification">("sound");

  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>설정</DialogTitle>
        <DialogDescription className="sr-only">타운 환경 설정</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        <nav aria-label="설정 카테고리" className="shrink-0 sm:w-32 sm:border-r sm:pr-6">
          <ul className="flex flex-col gap-1">
            <li>
              <button
                type="button"
                aria-current={activeCategory === "sound" ? "page" : undefined}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-center text-sm font-medium hover:bg-accent/50 active:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  activeCategory === "sound" && "bg-accent text-accent-foreground",
                )}
                onClick={() => setActiveCategory("sound")}
              >
                사운드
              </button>
            </li>
            <li>
              <button
                type="button"
                aria-current={activeCategory === "notification" ? "page" : undefined}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-center text-sm font-medium hover:bg-accent/50 active:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  activeCategory === "notification" && "bg-accent text-accent-foreground",
                )}
                onClick={() => setActiveCategory("notification")}
              >
                알림
              </button>
            </li>
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          {activeCategory === "sound" ? <AmbientSoundSettings /> : <PresenceNotificationSettings />}
        </div>
      </div>
    </DialogContent>
  );
}
