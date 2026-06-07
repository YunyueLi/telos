"use client";

// 入口 = 真实产品。无项目 → 全屏目标引导；有项目 → 地图主页（map = home）。
// 节点 → 详情 sheet → 开始学习（分步微课全屏接管）。所有数据来自 useProject 单一真相源。
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import NodePanel from "@/components/node-panel";
import PathView from "@/components/path-view";
import { useProject } from "@/lib/telos/use-project";
import { domainLabel } from "@/lib/telos/engine";
import { getDeriveUrl } from "@/lib/telos/derive";
import { EndpointConfig } from "@/components/endpoint-config";

const EXAMPLES = [
  "用 Rust 写一个高性能 HTTP 服务器",
  "三个月内跑完半程马拉松",
  "看懂一份上市公司财报，做价值投资判断",
  "理解 Transformer 与注意力机制",
  "从零学会古典吉他弹唱",
];

const DeriveCanvas = dynamic(() => import("@/components/canvas"), {
  ssr: false,
  loading: () => (
    <div className="loadrow" style={{ justifyContent: "center", height: "100%" }}>
      <span className="spinner" /> 加载地图…
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
  const [openNode, setOpenNode] = useState<string | null>(null);

  if (!ready) {
    return (
      <div className="appshell">
        <div className="loadrow" style={{ flex: 1, justifyContent: "center" }}>
          <span className="spinner" /> 载入中…
        </div>
      </div>
    );
  }

  if (!project || !graph || !view || composing) {
    return (
      <Onboarding
        derive={derive}
        deriving={deriving}
        deriveError={deriveError}
        canCancel={!!project || projects.length > 0}
        onCancel={cancelNew}
      />
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
  const [goal, setGoal] = useState("");
  const [mounted, setMounted] = useState(false);
  const [cfgUrl, setCfgUrl] = useState("");

  useEffect(() => {
    setMounted(true);
    setCfgUrl(getDeriveUrl());
  }, []);

  const run = (g: string) => {
    if (!g.trim() || deriving) return;
    setGoal(g);
    void derive(g);
  };

  return (
    <div className="appshell">
      <header className="appbar">
        <div className="appbar-in">
          <span className="appbrand">
            <svg className="sk" viewBox="0 0 24 24" aria-hidden="true">
              <use href="#i-compass" />
            </svg>
            <span>Telos</span>
          </span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
            {canCancel && (
              <button className="appstat" style={{ cursor: "pointer" }} onClick={onCancel}>
                <Icon name="arrow" style={{ width: 12, height: 12, transform: "rotate(180deg)" }} /> 返回学习
              </button>
            )}
            <span className="ob-hint" style={{ whiteSpace: "nowrap" }}>从结果倒推，学会任何事</span>
          </div>
        </div>
      </header>

      <div className="ob">
        <div>
          <div className="eyebrow">从结果倒推</div>
          <h1>
            说出你想达成的，
            <br />
            看它拆成一张学习地图
          </h1>
          <p className="ob-lead">
            写代码、跑马拉松、看财报、学乐器都行。引擎用逆向设计把目标拆成带前置依赖的能力图谱，诊断你的起点，只教你缺的，边教边验证。
          </p>

          <div className="ob-box">
            <textarea
              rows={3}
              placeholder="例如：用 FastAPI 写一个带 JWT 鉴权的 REST API 并部署上线"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(goal);
              }}
            />
            <div className="ob-bar">
              <span className="ob-hint">Cmd/Ctrl + Enter</span>
              <button
                className="btn btn-ink"
                style={{ marginLeft: "auto" }}
                onClick={() => run(goal)}
                disabled={deriving || !goal.trim()}
              >
                {deriving ? "倒推中…" : "倒推"} {!deriving && <Icon name="arrow" />}
              </button>
            </div>
          </div>

          {deriving && (
            <div className="loadrow">
              <span className="spinner" /> 正在倒推「{goal}」…（首次约 10–20 秒）
            </div>
          )}
          {deriveError && (
            <div className="errbox" style={{ marginTop: 14 }}>
              {deriveError}
            </div>
          )}

          <div className="ob-egs">
            <span className="lab">试试这些</span>
            {EXAMPLES.map((e) => (
              <button key={e} className="ob-eg" onClick={() => run(e)} disabled={deriving}>
                <i />
                {e}
              </button>
            ))}
          </div>

          {mounted && (
            <details className="ob-cfg" open={!cfgUrl}>
              <summary>
                <span className={`dot ${cfgUrl ? "dot-ok" : "dot-off"}`} />
                {cfgUrl ? "已配置倒推服务" : "未配置倒推服务 —— 展开设置"}
              </summary>
              <div className="cfgbody">
                {!cfgUrl && (
                  <>
                    本地两步：① <code>cd core</code> 后 <code>python3 serve.py</code> ② 选「本地 serve.py」点测试即可。线上用 Cloudflare Worker，见 DERIVE.md。
                  </>
                )}
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
            因为你想 <b>{project.goal}</b>，建议从 <b>{next.name}</b> 开始
            {view.total > 1 ? `（共 ${view.total} 个能力点）` : ""}。
          </div>
        )}

        {next ? (
          <div className="dark mh-cta">
            <div className="l">{fresh ? "从这里开始" : "推荐下一步 · 你的学习前沿"}</div>
            <div className="t">{next.name}</div>
            <div className="d">
              {fresh ? "它没有前置，是这张图的入口之一。" : "前置已全部掌握，正处你的学习前沿。"} 约 {next.minutes} 分钟。
            </div>
            <button className="btn btn-light gobtn" onClick={() => onOpenNode(next.id)}>
              <Icon name="play" /> 开始学习
            </button>
            <div className="meta">
              <span>{domainLabel(graph.get(next.id).domain)}</span>
              <span>{view.total - view.mastered} 个待学</span>
            </div>
          </div>
        ) : (
          <div className="dark mh-cta">
            <div className="l">目标达成</div>
            <div className="t">你已抵达目标</div>
            <div className="d">所有能力点都已掌握。保持间隔复习，巩固长期记忆。</div>
          </div>
        )}

        <div className="mh-card mh-card-paper">
          <h4>
            你的进度<span className="mh-n">{view.pct}%</span>
          </h4>
          <div className="mh-prog-row">
            <div className="big">
              {view.mastered}
              <sup> / {view.total}</sup>
            </div>
            <div className="sub">
              个能力点
              <br />
              已掌握
            </div>
          </div>
          <div className="mh-track">
            <i style={{ width: `${view.pct}%` }} />
          </div>
          <div className="mh-eta">
            {view.goalsReached ? "目标已达成" : `按当前节奏 · 预计 ${view.etaDays} 天达成`}
          </div>
          <div className="mh-legend" style={{ marginTop: 12 }}>
            <span>
              <i className="d" />
              已掌握
            </span>
            <span>
              <i />
              现在学
            </span>
            <span>
              <i className="k" />
              未解锁
            </span>
          </div>
        </div>

        <button className="btn btn-line mh-dxbtn" onClick={onDiagnose}>
          <Icon name="spark" /> {fresh ? "先测一测起点（更准）" : "重新测一测起点"}
        </button>

        <div className="mh-card">
          <h4>
            今日待复习<span className="mh-n">{view.due.length} 项</span>
          </h4>
          {view.due.length === 0 ? (
            <div className="mh-eta">今日无待复习 · 保持节奏</div>
          ) : (
            view.due.slice(0, 4).map((d) => (
              <button key={d.id} className="mh-due-row" onClick={() => onOpenNode(d.id)}>
                <Icon name="refresh" />
                <b>{d.name}</b>
                <span className="t">该复习</span>
              </button>
            ))
          )}
        </div>

        <div className="appstats" style={{ justifyContent: "center" }}>
          <span className="appstat">
            <Icon name="spark" /> {streak} 天连胜
          </span>
          <span className="appstat">{xp} XP</span>
        </div>
      </aside>
    </div>
  );
}
