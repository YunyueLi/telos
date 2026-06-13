// 学习项目库：把单一 telos:project 升级为「可存放多个学习项目」。
// 存储：telos:projects = { [id]: Project }，telos:active = 当前项目 id。
// 自动迁移旧的单项目 telos:project。供 useProject / 复习 / XP / 备份共用。
"use client";

import { emptyState, type KnowledgePoint, type LearnerState } from "./engine";

const PKEY = "telos:projects";
const AKEY = "telos:active";
const LEGACY = "telos:project";

export interface Project {
  id: string;
  goal: string;
  title?: string; // LLM 概括的简洁主题标题（导航/卡片显示）；旧项目可能无，回退到 goal
  points: KnowledgePoint[];
  state: LearnerState;
  createdAt: number;
  updatedAt: number;
}

// 导航/卡片用的简洁标题：优先 LLM 概括的 title，旧项目回退到完整 goal。
export function projectTitle(p: { title?: string; goal: string }): string {
  return (p.title && p.title.trim()) || p.goal;
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

// state 结构补全：旧格式 / 跨版本 / 云端同步回来的历史数据可能缺字段（如只有 mastery 没 cards），
// 渲染时 Object.keys(state.cards) 之类会抛 "Cannot convert undefined or null to object" → 整页白屏。
// 在读取边界统一用 emptyState() 补缺、并校验每个字段类型，保证结构完整向后兼容（正常项目本就完整 → 等价默认）。
function normalizeState(s: unknown): LearnerState {
  const base = emptyState();
  const o = (s && typeof s === "object" ? s : {}) as Partial<LearnerState>;
  return {
    mastery: o.mastery && typeof o.mastery === "object" ? o.mastery : base.mastery,
    cards: o.cards && typeof o.cards === "object" ? o.cards : base.cards,
    day: typeof o.day === "number" ? o.day : base.day,
    version: typeof o.version === "number" ? o.version : base.version,
  };
}

// 读取边界统一补全：每个流入 App 的项目都带结构完整的 state（localStorage 与云端同步共用此函数）。
export function normalizeProject(p: Project): Project {
  return { ...p, state: normalizeState(p.state) };
}

function readMap(): Record<string, Project> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PKEY);
    if (raw) {
      const m = JSON.parse(raw) as Record<string, unknown> | null;
      if (!m || typeof m !== "object") return {};
      const out: Record<string, Project> = {};
      // 跳过残缺(无 points)项目，并补全每个项目的 state，避免渲染时白屏（见 normalizeState）。
      for (const [id, p] of Object.entries(m)) {
        if (isValid(p)) out[id] = normalizeProject(p);
      }
      return out;
    }
    // 迁移旧的单项目
    const legacy = window.localStorage.getItem(LEGACY);
    if (legacy) {
      const p = JSON.parse(legacy) as Partial<Project>;
      if (isValid(p)) {
        const id = p.id || genId();
        const now = p.updatedAt || Date.now();
        const proj = normalizeProject({ ...p, id, createdAt: p.createdAt || now, updatedAt: now });
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
