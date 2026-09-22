"use client";

import { Button } from "@/shared/ui/button";
import { Bell, BellOff } from "lucide-react";

import { usePresenceNotificationStore } from "../model/usePresenceNotificationStore";

export function PresenceNotificationSettings() {
  const isEnabled = usePresenceNotificationStore((state) => state.isPresenceNotificationEnabled);
  const toggleNotification = usePresenceNotificationStore(
    (state) => state.togglePresenceNotification,
  );

  return (
    <section aria-labelledby="presence-notification-heading" className="flex flex-col gap-3">
      <h3 id="presence-notification-heading" className="text-sm font-semibold">
        알림
      </h3>

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">입장·퇴장 알림</span>
          <span className="text-muted-foreground text-xs">입장과 퇴장 알림을 표시해요.</span>
        </div>

        <Button
          type="button"
          variant={isEnabled ? "default" : "outline"}
          size="sm"
          role="switch"
          aria-checked={isEnabled}
          aria-label="입장·퇴장 알림"
          className="w-20 shrink-0 gap-2"
          onClick={toggleNotification}
        >
          {isEnabled ? (
            <Bell className="size-4" aria-hidden />
          ) : (
            <BellOff className="size-4" aria-hidden />
          )}
          {isEnabled ? "ON" : "OFF"}
        </Button>
      </div>
    </section>
  );
}
