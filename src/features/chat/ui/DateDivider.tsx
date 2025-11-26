"use client";

import { formatDate } from "@/shared/lib";

interface DateDividerProps {
  created_at: string;
}

export function DateDivider({ created_at }: DateDividerProps) {
  const label = formatDate(created_at);

  return (
    <div role="separator" aria-label={`날짜: ${label}`} className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-gray-300" />
      <span className="px-2 text-xs text-gray-400" aria-hidden="true">
        {label}
      </span>
      <div className="h-px flex-1 bg-gray-300" />
    </div>
  );
}
