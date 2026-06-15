"use client";

// 二十四节气：应时而现的时令系统。当前节气 → 时令卡(节气中文大字 + 看板娘应时话)。
// 节气日期每年浮动 ±1 天，此处用常年近似(够判断"当前在哪个节气")。
// 节气名作东方文化符号，各语言统一显示中文(像书法落款)；应时话按四季走 i18n。
export type Season = "spring" | "summer" | "autumn" | "winter";

export interface SolarTerm {
  name: string; // 节气中文名(书法大字)
  month: number;
  day: number;
  season: Season;
}

// 立春起，常年近似日期
export const SOLAR_TERMS: SolarTerm[] = [
  { name: "立春", month: 2, day: 4, season: "spring" },
  { name: "雨水", month: 2, day: 19, season: "spring" },
  { name: "惊蛰", month: 3, day: 6, season: "spring" },
  { name: "春分", month: 3, day: 21, season: "spring" },
  { name: "清明", month: 4, day: 5, season: "spring" },
  { name: "谷雨", month: 4, day: 20, season: "spring" },
  { name: "立夏", month: 5, day: 6, season: "summer" },
  { name: "小满", month: 5, day: 21, season: "summer" },
  { name: "芒种", month: 6, day: 6, season: "summer" },
  { name: "夏至", month: 6, day: 21, season: "summer" },
  { name: "小暑", month: 7, day: 7, season: "summer" },
  { name: "大暑", month: 7, day: 23, season: "summer" },
  { name: "立秋", month: 8, day: 8, season: "autumn" },
  { name: "处暑", month: 8, day: 23, season: "autumn" },
  { name: "白露", month: 9, day: 8, season: "autumn" },
  { name: "秋分", month: 9, day: 23, season: "autumn" },
  { name: "寒露", month: 10, day: 8, season: "autumn" },
  { name: "霜降", month: 10, day: 24, season: "autumn" },
  { name: "立冬", month: 11, day: 8, season: "winter" },
  { name: "小雪", month: 11, day: 22, season: "winter" },
  { name: "大雪", month: 12, day: 7, season: "winter" },
  { name: "冬至", month: 12, day: 22, season: "winter" },
  { name: "小寒", month: 1, day: 6, season: "winter" },
  { name: "大寒", month: 1, day: 20, season: "winter" },
];

// 当前节气：取 ≤ 今天的最后一个；年初(立春前)归上年大寒。
export function currentTerm(now: Date): SolarTerm {
  const m = now.getMonth() + 1;
  const d = now.getDate();
  let cur = SOLAR_TERMS[SOLAR_TERMS.length - 1]; // 大寒(默认)
  for (const t of SOLAR_TERMS) {
    if (t.month <= 1) continue; // 1 月的小寒/大寒单独处理(避免被当成"最早")
    if (m > t.month || (m === t.month && d >= t.day)) cur = t;
  }
  if (m === 1) cur = d >= 20 ? SOLAR_TERMS[23] : d >= 6 ? SOLAR_TERMS[22] : SOLAR_TERMS[23];
  return cur;
}

export function seasonOf(now: Date): Season {
  return currentTerm(now).season;
}
