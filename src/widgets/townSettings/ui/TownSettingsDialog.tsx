"use client";

import { AmbientSoundSettings } from "@/features/ambientSound";
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

/**
 * 설정 모달의 content shell.
 *
 * - `Dialog` root는 만들지 않는다. 상위(`TownSettingsButton`)의 `Dialog` context 안에서
 *   `DialogContent` 이하만 렌더한다.
 * - 데스크톱 2열 구조다. 왼쪽은 설정 카테고리 메뉴, 오른쪽은 선택한 카테고리의 내용.
 * - 카테고리가 "사운드" 하나뿐이라 전환 state나 카테고리 registry를 두지 않는다. 두 번째
 *   카테고리가 생기면 이 컴포넌트의 local state로 현재 카테고리를 들고 오른쪽 렌더를 분기한다.
 * - feature-specific 내용은 알지 않는다. 현재 오른쪽은 `AmbientSoundSettings` 하나.
 */
export function TownSettingsDialog() {
  return (
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>설정</DialogTitle>
        <DialogDescription className="sr-only">타운 환경 설정</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        <nav aria-label="설정 카테고리" className="shrink-0 sm:w-32 sm:border-r sm:pr-6">
          <ul>
            <li>
              <button
                type="button"
                aria-current="page"
                className="bg-accent text-accent-foreground focus-visible:ring-ring w-full rounded-md px-3 py-2 text-center text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
              >
                사운드
              </button>
            </li>
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
          <AmbientSoundSettings />
        </div>
      </div>
    </DialogContent>
  );
}
