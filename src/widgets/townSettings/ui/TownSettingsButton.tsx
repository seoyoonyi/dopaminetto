"use client";

import { useSettingsDialogStore } from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogTrigger } from "@/shared/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { Settings } from "lucide-react";

import { useEffect } from "react";

import { TownSettingsDialog } from "./TownSettingsDialog";

/**
 * 설정 모달의 진입점.
 *
 * - `Dialog` root와 controlled open 상태(`useSettingsDialogStore`)를 여기서 소유한다.
 *   (앱 전체에서 이 진입점의 `Dialog` root는 하나만 존재)
 * - trigger는 툴바 오른쪽 끝에 배치되는 compact icon 버튼이다. 배치는 app layer에서 한다.
 * - 닫힘 후 focus 복귀는 Radix Dialog 기본 동작에 맡긴다(커스텀 focus 관리 없음).
 */
export function TownSettingsButton() {
  const isOpen = useSettingsDialogStore((state) => state.isOpen);
  const setOpen = useSettingsDialogStore((state) => state.setOpen);

  // 설정 Dialog의 열림 상태는 transient UI state다. 페이지에 "재진입"하면 어떤 경로든 항상 닫혀야 한다.
  // useSettingsDialogStore는 persist하지 않지만 모듈 싱글턴이라, 한 번 뜬 JS 컨텍스트가 유지되는 한
  // isOpen=true가 살아남는다. 두 가지 재진입 경로를 모두 막는다.
  // 1) SPA 뒤로가기 등으로 이 컴포넌트가 재mount → mount 시 + unmount 시 닫는다.
  // 2) bfcache 복원처럼 재mount 없이 페이지 전체가 되살아나는 경우 → pageshow(event.persisted)에서 닫는다.
  //    단순 탭 전환은 visibilitychange라 여기 걸리지 않는다(의도적으로 닫지 않음).
  useEffect(() => {
    setOpen(false);

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setOpen(false);
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      setOpen(false);
    };
  }, [setOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="설정">
              <Settings className="size-4" aria-hidden />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>설정</TooltipContent>
      </Tooltip>

      <TownSettingsDialog />
    </Dialog>
  );
}
