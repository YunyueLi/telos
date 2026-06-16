"use client";

// 纸张主题：黑白纸感下的纸色/色温变体（cosmetic，纯外观，绝不影响功能/学习）。
// 免费 2 款（素白·宣纸）+ Pro 全解锁（牛皮·月白）。守纯黑白：只调纸墨色温，不引入彩色、不做深色翻转。
// 应用：切到 <html data-theme="...">，globals.css 按 data-theme 覆盖纸色变量，所有组件靠变量自适应。
import { bumpPrefs } from "./prefs-rev";

export interface PaperTheme {
  id: string;
  nameKey: string;
  paid: boolean;
  swatch: { paper: string; ink: string }; // 选择器小样
  face?: string; // 该主题绑定的看板娘画风立绘文件名（public/portraits/<face>.webp）；留空=用标准墨线。
}

export const THEMES: PaperTheme[] = [
  { id: "su", nameKey: "theme.su", paid: false, swatch: { paper: "#F0EEE9", ink: "#141310" } },
  { id: "xuan", nameKey: "theme.xuan", paid: false, swatch: { paper: "#F4EFE4", ink: "#141310" } },
  { id: "niupi", nameKey: "theme.niupi", paid: true, swatch: { paper: "#E8E0CF", ink: "#211A0E" } },
  { id: "yuebai", nameKey: "theme.yuebai", paid: true, swatch: { paper: "#ECEEF0", ink: "#13161A" } },
];

export const DEFAULT_THEME = "su";
const KEY = "telos:theme";

export function getTheme(): string {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    return window.localStorage.getItem(KEY) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function setTheme(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
  applyTheme(id);
  bumpPrefs(); // 主题皮=偏好：跨设备 LWW
}

// 把主题落到 <html data-theme>（默认主题清除属性，走 :root 原值）。
export function applyTheme(id: string): void {
  if (typeof document === "undefined") return;
  if (id === DEFAULT_THEME) document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", id);
}
