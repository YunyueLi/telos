"use client";

// 入口 = 真实产品。无项目 → 全屏目标引导；有项目 → 地图主页（map = home）。
// 节点 → 详情 sheet → 开始学习（分步微课全屏接管）。所有数据来自 useProject 单一真相源。
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import NodePanel from "@/components/node-panel";
import PathView from "@/components/path-view";
import { useProject } from "@/lib/telos/use-project";
import { domainLabel } from "@/lib/telos/engine";
import { engineReady, LLM_EVENT } from "@/lib/telos/derive";
import { useT, tStatic } from "@/lib/telos/i18n";

// 六类学习（domain A-F）+ 各一个代表性示例目标（i18n key）。点卡片填入输入框，覆盖 Telos 支持的全部学习机制。
const CATS: { domain: string; egKey: string }[] = [
  { domain: "A", egKey: "ob.catMemory" },
  { domain: "B", egKey: "ob.eg1" },
  { domain: "C", egKey: "ob.catCreate" },
  { domain: "D", egKey: "ob.eg5" },
  { domain: "E", egKey: "ob.catCompete" },
  { domain: "F", egKey: "ob.catHabit" },
];

const DeriveCanvas = dynamic(() => import("@/components/canvas"), {
  ssr: false,
  loading: () => (
    <div className="loadrow" style={{ justifyContent: "center", height: "100%" }}>
      <span className="spinner" /> {tStatic("common.loadingMap")}
    </div>
  ),
});

export default function HubPage() {
  const {
    ready,
    project,
    graph,
    view,
    derive,
    deriving,
    deriveError,
    record,
    composing,
  } = useProject();
  const router = useRouter();
  const { t } = useT();
  const [openNode, setOpenNode] = useState<string | null>(null);

  if (!ready) {
    return (
      <div className="appshell">
        <div className="loadrow" style={{ flex: 1, justifyContent: "center" }}>
          <span className="spinner" /> {t("common.loading")}
        </div>
      </div>
    );
  }

  if (!project || !graph || !view || composing) {
    return (
      <AppShell active="map">
        <Onboarding derive={derive} deriving={deriving} deriveError={deriveError} />
      </AppShell>
    );
  }

  return (
    <AppShell active="map">
      <MapHome
        onOpenNode={(id) => setOpenNode(id)}
        onDiagnose={() => router.push("/diagnose")}
      />
      {openNode && graph.get(openNode) && view && (
        <NodePanel
          graph={graph}
          view={view}
          state={project.state}
          pid={openNode}
          goal={project.goal}
          onClose={() => setOpenNode(null)}
          onLearned={record}
          onOpenNode={setOpenNode}
        />
      )}
    </AppShell>
  );
}

// ─────────────────────────── 引导 / 目标输入 ───────────────────────────
function Onboarding({
  derive,
  deriving,
  deriveError,
}: {
  derive: (g: string) => Promise<boolean>;
  deriving: boolean;
  deriveError: string | null;
}) {
  const { t } = useT();
  const [goal, setGoal] = useState("");
  const [mounted, setMounted] = useState(false);
  const [cfgUrl, setCfgUrl] = useState("");
  const [ms, setMs] = useState(0); // 倒推已用毫秒——驱动进度条 + 实时秒数
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const sync = () => setCfgUrl(engineReady() ? "ready" : "");
    sync();
    window.addEventListener(LLM_EVENT, sync); // 配好 key/端点后即时收起「需配置」提示
    return () => window.removeEventListener(LLM_EVENT, sync);
  }, []);

  // 倒推进行中：每 200ms 刷新；结束清零。
  useEffect(() => {
    if (!deriving) {
      setMs(0);
      return;
    }
    const t0 = Date.now();
    const id = setInterval(() => setMs(Date.now() - t0), 200);
    return () => clearInterval(id);
  }, [deriving]);

  const run = (g: string) => {
    if (!g.trim() || deriving) return;
    setGoal(g);
    void derive(g);
  };
  // 点分类卡：填入示例目标 + 聚焦输入框（让用户可改后再倒推，仿 ChatGPT 建议卡）
  const fill = (g: string) => {
    if (deriving) return;
    setGoal(g);
    const ta = taRef.current;
    if (ta) {
      ta.focus();
      ta.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  };

  // 倒推进度：缓动逼近 92%（永不假装完成，成功即切到地图），阶段=流水线真实步骤、按经验时间推进。
  const sec = Math.floor(ms / 1000);
  const progPct = Math.round(92 * (1 - Math.exp(-ms / 22000)));
  const PHASES: { at: number; key: string }[] = [
    { at: 0, key: "ob.phUnderstand" },
    { at: 6, key: "ob.phBlueprint" },
    { at: 18, key: "ob.phExpand" },
    { at: 52, key: "ob.phAssemble" },
  ];
  const phaseKey = (PHASES.filter((p) => sec >= p.at).pop() ?? PHASES[0]).key;

  return (
    <div className="ob">
      <div className="ob-hero">
        <div className="ob-hero-main">
          <div className="eyebrow">{t("ob.eyebrow")}</div>
          <h1>
            {t("ob.h1line1")}
            <br />
            {t("ob.h1line2")}
          </h1>
          <p className="ob-lead">{t("ob.lead")}</p>

          <div className="ob-box">
            <textarea
              ref={taRef}
              rows={2}
              placeholder={t("ob.placeholder")}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(goal);
              }}
            />
            <div className="ob-bar">
              <span className="ob-hint">{t("ob.hintKbd")}</span>
              <button
                className="btn btn-ink"
                style={{ marginLeft: "auto" }}
                onClick={() => run(goal)}
                disabled={deriving || !goal.trim()}
              >
                {deriving ? t("ob.deriving") : t("ob.derive")} {!deriving && <Icon name="arrow" />}
              </button>
            </div>
          </div>

          {deriving && (
            <div className="ob-prog" role="status" aria-live="polite">
              <div className="ob-prog-bar">
                <i style={{ width: `${progPct}%` }} />
              </div>
              <div className="ob-prog-row">
                <span className="ob-prog-phase">
                  {t(phaseKey)}
                  <span className="ob-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </span>
                <span className="ob-prog-sec">{t("ob.derivingSec", { sec })}</span>
              </div>
              <div className="ob-prog-goal">{t("ob.derivingFor", { goal })}</div>
            </div>
          )}
          {deriveError && <div className="errbox">{deriveError}</div>}
        </div>

        <aside className="ob-art">
          <svg className="deco skL" viewBox="0 0 330 360" aria-hidden="true">
            <circle cx="165" cy="176" r="150" strokeDasharray="2 10" />
            <path d="M295 130l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" />
            <path d="M32 250l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" />
            <path d="M270 270c9-6 17-6 24 0" strokeWidth="2.2" />
          </svg>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="pcirc">
            <img src={asset("/portraits/present.png")} alt="Telos 老师" />
          </span>
        </aside>
      </div>

      <div className="ob-cats">
        <span className="lab">{t("ob.examplesLab")}</span>
        <div className="ob-catgrid">
          {CATS.map((c) => {
            const eg = t(c.egKey);
            return (
              <button key={c.domain} className="ob-cat" onClick={() => fill(eg)} disabled={deriving} title={eg}>
                <span className="ob-cat-k">{domainLabel(c.domain, t)}</span>
                <span className="ob-cat-g">{eg}</span>
              </button>
            );
          })}
        </div>
      </div>

      {mounted && !cfgUrl && (
        <Link href="/settings" className="ob-cfglink">
          <span className="dot dot-off" /> {t("ob.cfgNeed")}
          <Icon name="arrow" style={{ width: 12, height: 12 }} />
        </Link>
      )}
    </div>
  );
}

// ─────────────────────────── 地图主页 ───────────────────────────
function MapHome({
  onOpenNode,
  onDiagnose,
}: {
  onOpenNode: (id: string) => void;
  onDiagnose: () => void;
}) {
  const { project, graph, view, xp, streak } = useProject();
  const { t } = useT();
  const [isPhone, setIsPhone] = useState(false);
  // 手机上默认走「路径」（线性引导，适合竖屏单手），但可切到「地图」看全局画布（缩放/平移）。
  const [phoneView, setPhoneView] = useState<"path" | "map">("path");
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    const saved = localStorage.getItem("telos:mapview");
    if (saved === "map" || saved === "path") setPhoneView(saved);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const pickView = (v: "path" | "map") => {
    setPhoneView(v);
    try {
      localStorage.setItem("telos:mapview", v);
    } catch {
      /* ignore */
    }
  };

  if (!project || !graph || !view) return null;
  const fresh = view.mastered === 0;
  const next = view.next;

  return (
    <div className="mh">
      <div className="mh-map">
        {isPhone && (
          <div className="mh-viewtoggle" role="tablist" aria-label={t("home.viewToggle")}>
            <button
              role="tab"
              aria-selected={phoneView === "path"}
              className={phoneView === "path" ? "on" : ""}
              onClick={() => pickView("path")}
            >
              <Icon name="compass" style={{ width: 14, height: 14 }} /> {t("home.viewPath")}
            </button>
            <button
              role="tab"
              aria-selected={phoneView === "map"}
              className={phoneView === "map" ? "on" : ""}
              onClick={() => pickView("map")}
            >
              <Icon name="map" style={{ width: 14, height: 14 }} /> {t("home.viewMap")}
            </button>
          </div>
        )}
        {isPhone && phoneView === "path" ? (
          <PathView graph={graph} view={view} onOpenNode={onOpenNode} />
        ) : (
          <DeriveCanvas graph={graph} view={view} onOpenNode={onOpenNode} title={project.title || project.goal} />
        )}
      </div>

      <aside className="mh-rail">
        {fresh && next && (
          <div className="mh-recap">
            {t("home.recap", {
              goal: project.goal,
              next: next.name,
              count: view.total > 1 ? t("home.recapCount", { total: view.total }) : "",
            })}
          </div>
        )}

        {next ? (
          <div className="dark mh-cta">
            <div className="l">{fresh ? t("home.ctaStart") : t("home.ctaNext")}</div>
            <div className="t">{next.name}</div>
            <div className="d">
              {fresh ? t("home.ctaDescFresh") : t("home.ctaDescNext")} {t("home.minutes", { min: next.minutes })}
            </div>
            <button className="btn btn-light gobtn" onClick={() => onOpenNode(next.id)}>
              <Icon name="play" /> {t("home.startLearn")}
            </button>
            <div className="meta">
              <span>{domainLabel(graph.get(next.id).domain, t)}</span>
              <span>{t("home.toLearn", { n: view.total - view.mastered })}</span>
            </div>
          </div>
        ) : (
          <div className="dark mh-cta">
            <div className="l">{t("home.goalReachedL")}</div>
            <div className="t">{t("home.goalReachedT")}</div>
            <div className="d">{t("home.goalReachedD")}</div>
          </div>
        )}

        <div className="mh-card mh-card-paper">
          <h4>
            {t("home.progress")}
            <span className="mh-n">{view.pct}%</span>
          </h4>
          <div className="mh-prog-row">
            <div className="big">
              {view.mastered}
              <sup> / {view.total}</sup>
            </div>
            <div className="sub">
              {t("home.progUnit")}
              <br />
              {t("word.mastered")}
            </div>
          </div>
          <div className="mh-track">
            <i style={{ width: `${view.pct}%` }} />
          </div>
          <div className="mh-eta">
            {view.goalsReached ? t("home.etaReached") : t("home.eta", { days: view.etaDays })}
          </div>
          <div className="mh-legend" style={{ marginTop: 12 }}>
            <span>
              <i className="d" />
              {t("legend.mastered")}
            </span>
            <span>
              <i />
              {t("legend.now")}
            </span>
            <span>
              <i className="k" />
              {t("legend.locked")}
            </span>
          </div>
        </div>

        {view.modules.length > 1 && (
          <div className="mh-card mh-card-paper">
            <h4>
              {t("home.modulesTitle")}
              <span className="mh-n">{t("home.modulesCount", { n: view.modules.length })}</span>
            </h4>
            <div className="mh-mods">
              {view.modules.map((m, i) => {
                const mp = m.total ? Math.round((m.mastered / m.total) * 100) : 0;
                return (
                  <button key={m.id} className="mh-mod" onClick={() => onOpenNode(m.firstId)} title={m.title}>
                    <span className="mh-mod-i">{String(i + 1).padStart(2, "0")}</span>
                    <span className="mh-mod-main">
                      <span className="mh-mod-t">{m.title}</span>
                      <span className="mh-mod-track">
                        <i style={{ width: `${mp}%` }} />
                      </span>
                    </span>
                    <span className="mh-mod-n">
                      {m.mastered}/{m.total}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button className="btn btn-line mh-dxbtn" onClick={onDiagnose}>
          <Icon name="spark" /> {fresh ? t("home.diagnoseFirst") : t("home.diagnoseAgain")}
        </button>

        <div className="mh-card">
          <h4>
            {t("home.dueTitle")}
            <span className="mh-n">{t("home.dueCount", { n: view.due.length })}</span>
          </h4>
          {view.due.length === 0 ? (
            <div className="mh-eta">{t("home.dueEmpty")}</div>
          ) : (
            view.due.slice(0, 4).map((d) => (
              <button key={d.id} className="mh-due-row" onClick={() => onOpenNode(d.id)}>
                <Icon name="refresh" />
                <b>{d.name}</b>
                <span className="t">{t("home.dueReview")}</span>
              </button>
            ))
          )}
        </div>

        <div className="appstats" style={{ justifyContent: "center" }}>
          <span className="appstat">
            <Icon name="spark" /> {t("stat.streak", { n: streak })}
          </span>
          <span className="appstat">{t("stat.xp", { n: xp })}</span>
        </div>
      </aside>
    </div>
  );
}
