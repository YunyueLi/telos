"use client";

// 学习项目切换器：顶栏「目标」处的下拉（桌面）/ 底部抽屉（移动）。
// 调研依据：
//  - 项目数有限 → 下拉式切换器优于命令面板（Mobbin / UX Patterns）。
//  - 最近优先排序 + 状态分面 + 计数（Algolia / NN/g 过滤排序最佳实践）。
//  - 搜索高亮匹配、空态引导、键盘优先。
//  - 组合框 + 列表框键盘模型（WAI-ARIA APG）：↑/↓ 移动、Enter 选中、Esc 关闭并归还焦点。
//  - 移动端底部抽屉，触达舒适、断点稳定。
// 覆盖层用 portal 挂到 body：避开 .appbar 的 backdrop-filter 对 fixed 子元素造成的包含块问题。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useProject } from "@/lib/telos/use-project";
import { projectTitle, type Project } from "@/lib/telos/project";
import { KnowledgeGraph } from "@/lib/telos/engine";
import { buildView } from "@/lib/telos/store";
import { useT } from "@/lib/telos/i18n";

type SortKey = "recent" | "progress" | "due" | "name";
type FilterKey = "all" | "learning" | "due" | "done";
interface Stat {
  pct: number;
  mastered: number;
  total: number;
  due: number;
  done: boolean;
}

const PANEL_W = 392;

// 本地化相对时间（"3天前"），用平台 Intl 免去 9 语手翻。
function rel(ts: number, lang: string): string {
  try {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    const sec = Math.round((ts - Date.now()) / 1000);
    if (Math.abs(sec) < 60) return rtf.format(sec, "second");
    const min = Math.round(sec / 60);
    if (Math.abs(min) < 60) return rtf.format(min, "minute");
    const hr = Math.round(min / 60);
    if (Math.abs(hr) < 24) return rtf.format(hr, "hour");
    const day = Math.round(hr / 24);
    if (Math.abs(day) < 7) return rtf.format(day, "day");
    const wk = Math.round(day / 7);
    if (Math.abs(wk) < 4) return rtf.format(wk, "week");
    const mo = Math.round(day / 30);
    if (Math.abs(mo) < 12) return rtf.format(mo, "month");
    return rtf.format(Math.round(day / 365), "year");
  } catch {
    return "";
  }
}

// 搜索命中高亮（大小写不敏感，首个匹配）
function highlight(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="psw-hl">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export function ProjectSwitcher() {
  const { t, lang } = useT();
  const router = useRouter();
  const { projects, project, switchProject, startNew } = useProject();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [active, setActive] = useState(0);
  const [isPhone, setIsPhone] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const apply = () => setIsPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // 每个项目的进度 / 待复习 / 是否达成（仅开面板时计算）
  const stats = useMemo<Record<string, Stat>>(() => {
    if (!open) return {};
    const m: Record<string, Stat> = {};
    for (const p of projects) {
      try {
        const v = buildView(new KnowledgeGraph(p.points), p.state, t);
        m[p.id] = { pct: v.pct, mastered: v.mastered, total: v.total, due: v.due.length, done: v.goalsReached };
      } catch {
        m[p.id] = { pct: 0, mastered: 0, total: p.points.length, due: 0, done: false };
      }
    }
    return m;
  }, [open, projects, t]);

  const counts = useMemo(() => {
    const c = { all: projects.length, learning: 0, due: 0, done: 0 };
    for (const p of projects) {
      const s = stats[p.id];
      if (!s) continue;
      if (!s.done) c.learning++;
      if (s.due > 0) c.due++;
      if (s.done) c.done++;
    }
    return c;
  }, [projects, stats]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = projects.filter((p) => {
      if (q && !projectTitle(p).toLowerCase().includes(q) && !p.goal.toLowerCase().includes(q)) return false;
      const s = stats[p.id];
      if (!s) return filter === "all";
      if (filter === "learning") return !s.done;
      if (filter === "due") return s.due > 0;
      if (filter === "done") return s.done;
      return true;
    });
    const st = (id: string) => stats[id];
    const cmp: Record<SortKey, (a: Project, b: Project) => number> = {
      recent: (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
      progress: (a, b) => (st(b.id)?.pct ?? 0) - (st(a.id)?.pct ?? 0),
      due: (a, b) => (st(b.id)?.due ?? 0) - (st(a.id)?.due ?? 0),
      name: (a, b) => projectTitle(a).localeCompare(projectTitle(b), lang),
    };
    return [...filtered].sort(cmp[sort]);
  }, [projects, query, filter, sort, stats, lang]);

  const openPanel = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (r) setAnchor({ x: r.left, y: r.bottom });
    setActive(0);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setFilter("all");
    triggerRef.current?.focus();
  }, []);

  // 打开后聚焦搜索框
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // 桌面定位用绝对坐标，窗口尺寸变化即关闭，避免错位
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [open, close]);

  // active 越界修正
  useEffect(() => {
    setActive((i) => (i >= list.length ? Math.max(0, list.length - 1) : i));
  }, [list.length]);

  // 键盘高亮项滚动入视
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = useCallback(
    (p: Project) => {
      if (p.id !== project?.id) switchProject(p.id);
      setOpen(false);
      setQuery("");
      setFilter("all");
      router.push("/");
    },
    [project?.id, switchProject, router],
  );

  const onNew = useCallback(() => {
    setOpen(false);
    setQuery("");
    startNew();
    router.push("/");
  }, [startNew, router]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(list.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(list.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = list[active];
      if (p) choose(p);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  if (!project) return null;

  const FILTERS: { k: FilterKey; label: string; n: number }[] = [
    { k: "all", label: t("psw.fAll"), n: counts.all },
    { k: "learning", label: t("psw.fLearning"), n: counts.learning },
    { k: "due", label: t("psw.due"), n: counts.due },
    { k: "done", label: t("psw.fDone"), n: counts.done },
  ];

  const popStyle: React.CSSProperties =
    !isPhone && anchor
      ? {
          top: anchor.y + 8,
          left: Math.max(12, Math.min(anchor.x, (typeof window !== "undefined" ? window.innerWidth : 1280) - PANEL_W - 12)),
        }
      : {};

  return (
    <div className="psw">
      <button
        ref={triggerRef}
        className={`psw-chip ${open ? "on" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`${project.goal}　·　${t("psw.switchTitle")}`}
        onClick={() => (open ? close() : openPanel())}
      >
        <span className="appgoal-l">{t("shell.goalLabel")}</span>
        <span className="psw-chip-t">{projectTitle(project)}</span>
        <Icon name="chevron" className="psw-cv" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="psw-backdrop" onClick={close} aria-hidden="true" />
            <div
              className={`psw-panel ${isPhone ? "sheet" : "pop"}`}
              style={popStyle}
              role="dialog"
              aria-modal="true"
              aria-label={t("psw.heading")}
            >
              {isPhone && <div className="psw-grab" aria-hidden="true" />}
              <div className="psw-head">
                <span>{t("psw.heading")}</span>
                <button className="psw-x" onClick={close} aria-label={t("common.close")}>
                  <Icon name="x" />
                </button>
              </div>

              <div className="psw-search">
                <Icon name="search" className="psw-si" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKey}
                  placeholder={t("psw.search")}
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-activedescendant={list[active] ? `${listId}-${active}` : undefined}
                  aria-autocomplete="list"
                  spellCheck={false}
                  autoComplete="off"
                />
                {query && (
                  <button
                    className="psw-clear"
                    onClick={() => {
                      setQuery("");
                      setActive(0);
                      inputRef.current?.focus();
                    }}
                    aria-label={t("common.clear")}
                  >
                    <Icon name="x" />
                  </button>
                )}
              </div>

              <div className="psw-controls">
                <div className="psw-chips">
                  {FILTERS.map((f) => (
                    <button
                      key={f.k}
                      className={`psw-fchip ${filter === f.k ? "on" : ""}`}
                      aria-pressed={filter === f.k}
                      onClick={() => {
                        setFilter(f.k);
                        setActive(0);
                      }}
                    >
                      {f.label}
                      <i>{f.n}</i>
                    </button>
                  ))}
                </div>
                <label className="psw-sort">
                  <span>{t("psw.sortLabel")}</span>
                  <select
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value as SortKey);
                      setActive(0);
                    }}
                  >
                    <option value="recent">{t("psw.sortRecent")}</option>
                    <option value="progress">{t("psw.sortProgress")}</option>
                    <option value="due">{t("psw.due")}</option>
                    <option value="name">{t("psw.sortName")}</option>
                  </select>
                  <Icon name="chevron" className="psw-sortcv" />
                </label>
              </div>

              <div className="psw-list" id={listId} role="listbox" ref={listRef} aria-label={t("psw.heading")}>
                {list.length === 0 ? (
                  <div className="psw-empty">
                    <Icon name="search" />
                    <p>{query ? t("psw.noMatch", { q: query }) : t("me.noProjects")}</p>
                  </div>
                ) : (
                  list.map((p, i) => {
                    const s = stats[p.id] ?? { pct: 0, mastered: 0, total: p.points.length, due: 0, done: false };
                    const cur = p.id === project.id;
                    return (
                      <button
                        key={p.id}
                        id={`${listId}-${i}`}
                        data-i={i}
                        role="option"
                        aria-selected={cur}
                        className={`psw-opt ${cur ? "on" : ""} ${i === active ? "active" : ""}`}
                        onMouseMove={() => active !== i && setActive(i)}
                        onClick={() => choose(p)}
                      >
                        <span className="psw-opt-main">
                          <span className="psw-opt-title">
                            {cur && <i className="psw-cur">{t("me.current")}</i>}
                            <span className="psw-opt-name">{highlight(projectTitle(p), query)}</span>
                            {s.done && <Icon name="check" className="psw-okic" />}
                          </span>
                          <span className="psw-opt-meta">
                            {t("me.projMastered", { m: s.mastered, t: s.total })}
                            <i className="psw-mdot" aria-hidden="true">·</i>
                            {rel(p.updatedAt, lang)}
                          </span>
                          <span className="psw-bar">
                            <i style={{ width: `${s.pct}%` }} />
                          </span>
                        </span>
                        <span className="psw-opt-side">
                          {s.due > 0 && (
                            <span className="psw-due" title={t("nav.review")}>
                              <Icon name="refresh" /> {s.due}
                            </span>
                          )}
                          <span className="psw-pct">{s.pct}%</span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="psw-foot">
                <button className="psw-new" onClick={onNew}>
                  <Icon name="plus" /> {t("shell.new")}
                </button>
                <Link href="/settings" className="psw-manage" onClick={close}>
                  {t("psw.manage")} <Icon name="arrow" />
                </Link>
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
