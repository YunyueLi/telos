// 学习项目库：把单一 telos:project 升级为「可存放多个学习项目」。
// 存储：telos:projects = { [id]: Project }，telos:active = 当前项目 id。
// 自动迁移旧的单项目 telos:project。供 useProject / 复习 / XP / 备份共用。
"use client";

import type { KnowledgePoint, LearnerState } from "./engine";

const PKEY = "telos:projects";
const AKEY = "telos:active";
const LEGACY = "telos:project";

export interface Project {
  id: string;
  goal: string;
  points: KnowledgePoint[];
  state: LearnerState;
  createdAt: number;
  updatedAt: number;
}

export function genId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function isValid(p: unknown): p is Project {
  const o = p as Project | null;
  return !!o && Array.isArray(o.points) && o.points.length > 0 && !!o.state;
}

function readMap(): Record<string, Project> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PKEY);
    if (raw) {
      const m = JSON.parse(raw) as Record<string, Project>;
      return m && typeof m === "object" ? m : {};
    }
    // 迁移旧的单项目
    const legacy = window.localStorage.getItem(LEGACY);
    if (legacy) {
      const p = JSON.parse(legacy) as Partial<Project>;
      if (isValid(p)) {
        const id = p.id || genId();
        const now = p.updatedAt || Date.now();
        const proj: Project = {
          id,
          goal: p.goal!,
          points: p.points!,
          state: p.state!,
          createdAt: p.createdAt || now,
          updatedAt: now,
        };
        const map = { [id]: proj };
        window.localStorage.setItem(PKEY, JSON.stringify(map));
        if (!window.localStorage.getItem(AKEY)) window.localStorage.setItem(AKEY, id);
        window.localStorage.removeItem(LEGACY);
        return map;
      }
    }
    return {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, Project>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PKEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

export function listProjects(): Project[] {
  return Object.values(readMap())
    .filter(isValid)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getActiveId(): string | null {
  if (typeof window === "undefined") return null;
  const map = readMap();
  const id = window.localStorage.getItem(AKEY);
  if (id && map[id]) return id;
  const recent = listProjects()[0];
  return recent ? recent.id : null;
}

export function setActiveId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(AKEY, id);
    else window.localStorage.removeItem(AKEY);
  } catch {
    /* ignore */
  }
}

export function loadActive(): Project | null {
  const id = getActiveId();
  if (!id) return null;
  return readMap()[id] ?? null;
}

export function upsertProject(p: Project): void {
  const map = readMap();
  map[p.id] = p;
  writeMap(map);
}

export function deleteProject(id: string): void {
  const map = readMap();
  delete map[id];
  writeMap(map);
  if (typeof window !== "undefined" && window.localStorage.getItem(AKEY) === id) {
    setActiveId(listProjects()[0]?.id ?? null);
  }
}
