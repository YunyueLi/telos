// 倒推「活动项目」的本地持久化：把 /derive 学出来的图谱 + 学习状态存盘，
// 让复习页(#2)、XP(#3)、云同步(#4)都能读同一份。先做本地，云同步走 cloud.ts。
"use client";

import type { KnowledgePoint, LearnerState } from "./engine";

const KEY = "telos:project";

export interface Project {
  goal: string;
  points: KnowledgePoint[];
  state: LearnerState;
  updatedAt: number;
}

export function saveProject(p: Project): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore quota */
  }
}

export function loadProject(): Project | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    const p = raw ? (JSON.parse(raw) as Project) : null;
    return p && Array.isArray(p.points) && p.points.length ? p : null;
  } catch {
    return null;
  }
}

export function clearProject(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
