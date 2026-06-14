"use client";

// 应用已存的纸张主题。用 client effect 而非 inline <script>：避免「script tag in React component」
// 警告与 <html> 属性的 hydration 不匹配。代价是切过非默认主题的用户首屏极轻微闪一下（默认 su 无影响）。
import { useEffect } from "react";
import { applyTheme, getTheme } from "@/lib/telos/theme";

export function ThemeInit() {
  useEffect(() => {
    applyTheme(getTheme());
  }, []);
  return null;
}
