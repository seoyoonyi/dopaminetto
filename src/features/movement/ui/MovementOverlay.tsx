"use client";

import { LOCAL_ACTION_KEY_BINDINGS } from "@/features/movement/model/actionAnimation";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

export function MovementOverlay() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="캐릭터 조작 안내 열기"
          className="absolute bottom-4 right-4 z-10 h-auto cursor-pointer rounded bg-white/80 p-2 text-xs text-gray-900 hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          이동: 방향키 / WASD · 🎮 조작 안내
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={8}
        className="after:absolute after:-bottom-1 after:right-8 after:size-2 after:rotate-45 after:border-b after:border-r after:border-border after:bg-popover w-80"
      >
        <div className="space-y-3">
          <h2 className="font-display text-sm font-semibold text-gray-900">캐릭터 조작 안내</h2>
          <dl className="space-y-2 text-xs text-gray-700">
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <dt className="font-medium">방향키 / WASD</dt>
              <dd>캐릭터 이동</dd>
            </div>
            {Object.values(LOCAL_ACTION_KEY_BINDINGS).map(({ label, actionLabel }) => (
              <div className="grid grid-cols-[8rem_1fr] gap-2" key={label}>
                <dt className="font-medium">{label}</dt>
                <dd>{actionLabel}</dd>
              </div>
            ))}
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <dt className="font-medium">이동키 / Space</dt>
              <dd>현재 액션 해제</dd>
            </div>
            <div className="grid grid-cols-[8rem_1fr] gap-2">
              <dt className="font-medium">Escape / 맵 클릭</dt>
              <dd>채팅 포커스 해제</dd>
            </div>
          </dl>
        </div>
      </PopoverContent>
    </Popover>
  );
}
