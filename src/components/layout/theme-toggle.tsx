"use client";

import { SunMoon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/providers/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggleTheme}
      aria-label={isDark ? "切换到亮色背景" : "切换到暗色背景"}
      title={isDark ? "切换到亮色" : "切换到暗色"}
    >
      <SunMoon className="size-4" />
    </Button>
  );
}
