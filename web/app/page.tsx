"use client";

// 入口 = 真实产品。无项目 → 全屏目标引导；有项目 → 地图主页（map = home）。
// 节点 → 详情 sheet → 开始学习（分步微课全屏接管）。所有数据来自 useProject 单一真相源。
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import NodePanel from "@/components/node-panel";
import PathView from "@/components/path-view";
import { useProject } from "@/lib/telos/use-project";
import { domainLabel } from "@/lib/telos/engine";
import { getDeriveUrl } from "@/lib/telos/derive";
import { EndpointConfig } from "@/components/endpoint-config";
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
    projects,
    derive,
    deriving,
    deriveError,
    record,
    composing,
    cancelNew,
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
        <Onboarding
          derive={derive}
          deriving={deriving}
          deriveError={deriveError}
          canCancel={!!project || projects.length > 0}
          onCancel={cancelNew}
        />
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
  canCancel,
  onCancel,
}: {
  derive: (g: string) => Promise<boolean>;
  deriving: boolean;
  deriveError: string | null;
  canCancel?: boolean;
  onCancel?: () => void;
}) {
  const { t } = useT();
  const [goal, setGoal] = useState("");
  const [mounted, setMounted] = useState(false);
  const [cfgUrl, setCfgUrl] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setMounted(true);
    setCfgUrl(getDeriveUrl());
  }, []);

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

  return (
    <div className="ob">
      <div>
        {canCancel && (
          <button className="ob-back" onClick={onCancel}>
            <Icon name="arrow" style={{ width: 12, height: 12, transform: "rotate(180deg)", verticalAlign: -1, marginRight: 5 }} />
            {t("ob.backToLearn")}
          </button>
        )}
        <h1>
          {t("ob.h1line1")}
          <br />
          {t("ob.h1line2")}
        </h1>
        <p className="ob-lead">{t("ob.lead")}</p>

        <div className="ob-box">
          <textarea
            ref={taRef}
            rows={3}
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
          <div className="loadrow">
            <span className="spinner" /> {t("ob.derivingLine", { goal })}
          </div>
        )}
        {deriveError && (
          <div className="errbox" style={{ marginTop: 14 }}>
            {deriveError}
          </div>
        )}

        <div className="ob-cats">
          <span className="lab">{t("ob.examplesLab")}</span>
          <div className="ob-catgrid">
            {CATS.map((c) => {
              const eg = t(c.egKey);
              return (
                <button key={c.domain} className="ob-cat" onClick={() => fill(eg)} disabled={deriving}>
                  <span className="ob-cat-k">{domainLabel(c.domain, t)}</span>
                  <span className="ob-cat-g">{eg}</span>
                </button>
              );
            })}
          </div>
        </div>

        {mounted && (
            <details className="ob-cfg" open={!cfgUrl}>
              <summary>
                <span className={`dot ${cfgUrl ? "dot-ok" : "dot-off"}`} />
                {cfgUrl ? t("ob.cfgConfigured") : t("ob.cfgUnconfigured")}
              </summary>
              <div className="cfgbody">
                {!cfgUrl && <>{t("ob.cfgHelp")}</>}
                <EndpointConfig onSaved={setCfgUrl} />
              </div>
            </details>
          )}
        </div>

        <aside className="ob-art">
          <svg className="deco skL" viewBox="0 0 330 360">
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
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!project || !graph || !view) return null;
  const fresh = view.mastered === 0;
  const next = view.next;

  return (
    <div className="mh">
      <div className="mh-map">
        {isPhone ? (
          <PathView graph={graph} view={view} onOpenNode={onOpenNode} />
        ) : (
          <DeriveCanvas graph={graph} view={view} onOpenNode={onOpenNode} />
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
