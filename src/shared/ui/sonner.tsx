"use client";

import { cn } from "@/lib/utils";
import { Toaster as Sonner, ToasterProps } from "sonner";

import { useTheme } from "next-themes";

const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          toast: cn(toastOptions?.classNames?.toast, "font-display text-xs"),
          title: cn(toastOptions?.classNames?.title, "font-display text-xs"),
          description: cn(toastOptions?.classNames?.description, "font-display text-xs"),
          actionButton: cn(toastOptions?.classNames?.actionButton, "font-display text-xs"),
          cancelButton: cn(toastOptions?.classNames?.cancelButton, "font-display text-xs"),
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
