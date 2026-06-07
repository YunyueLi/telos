"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icon";
import styles from "./derive.module.css";
import {
  Diagnosis,
  GOOD,
  KnowledgeGraph,
  type LearnerState,
  domainLabel,
  emptyState,
  newCard,
  recordResult,
  review,
  usesFsrs,
} from "@/lib/telos/engine";
import { buildView } from "@/lib/telos/store";
import { layeredLayout } from "@/lib/telos/layout";
import {
  deriveGraph,
  generateProbes,
  getDeriveUrl,
  setDeriveUrl,
  type DerivedGraph,
  type Probe,
} from "@/lib/telos/derive";
import NodePanel from "./node-panel";
import PathView from "./path-view";
import { clearProject, loadProject, saveProject } from "@/lib/telos/project";
import { computeXp, getStreak, touchStreak } from "@/lib/telos/xp";

const EXAMPLES = [
  "用 Rust 写一个高性能 HTTP 服务器",
  "三个月内跑完半程马拉松",
  "看懂一份上市公司财报，做价值投资判断",
  "理解 Transformer 与注意力机制",
  "从零学会古典吉他弹唱",
];

// 画布走 React Flow，必须只在客户端加载（静态导出 + DOM 测量）。
const DeriveCanvas = dynamic(() => import("./canvas"), {
  ssr: false,
  loading: () => (
    <div
      className={styles.rfWrap}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--ink-3)",
        fontFamily: "var(--mono)",
        fontSize: 13,
      }}
    >
      加载画布…
    </div>
  ),
});

// 用交互诊断累积的 BKT 信念构造学习状态（与 engine.diagnose 的状态构造一致，
// 但只反映用户真实答过的题，未答的不强行置否）。
function stateFromDiagnosis(d: Diagnosis, g: KnowledgeGraph): LearnerState {
  const s = emptyState();
  for (const id of g.ids()) s.mastery[id] = d.belief[id] >= 0.6 ? 0.9 : d.belief[id];
  for (const id of g.ids())
    if (d.belief[id] >= 0.6 && usesFsrs(g.get(id).domain)) s.cards[id] = review(newCard(), GOOD, 0);
  s.version += 1;
  return s;
}

export default function DerivePage() {
  const [goal, setGoal] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "ready">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<DerivedGraph | null>(null);
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [state, setState] = useState<LearnerState>(() => emptyState());

  // 端点配置（客户端读 localStorage / env）
  const [mounted, setMounted] = useState(false);
  const [cfgUrl, setCfgUrl] = useState("");
  const [urlDraft, setUrlDraft] = useState("");

  // 诊断
  const dxRef = useRef<Diagnosis | null>(null);
  const probesRef = useRef<Record<string, Probe>>({});
  const [diagnosing, setDiagnosing] = useState(false);
  const [dxPhase, setDxPhase] = useState<"intro" | "loading" | "asking">("intro");
  const [dxQ, setDxQ] = useState<string | null>(null);
  const [dxCount, setDxCount] = useState(0);
  const [dxChoice, setDxChoice] = useState<number | null>(null);
  const [dxConf, setDxConf] = useState<"low" | "mid" | "high" | null>(null);
  const [dxErr, setDxErr] = useState<string | null>(null);

  // 节点详情抽屉
  const [openNode, setOpenNode] = useState<string | null>(null);

  const [streak, setStreak] = useState(0);

  // 手机竖屏(≤640)走专门的蜿蜒路径渲染器，否则 React Flow
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setMounted(true);
    setStreak(getStreak());
    const u = getDeriveUrl();
    setCfgUrl(u);
    setUrlDraft(u);
    // 恢复上次的倒推项目（学习进度不丢）
    const p = loadProject();
    if (p) {
      setResult({ goal: p.goal, points: p.points });
      setGraph(new KnowledgeGraph(p.points));
      setState(p.state);
      setPhase("ready");
    }
  }, []);

  // 落盘：把当前倒推项目 + 学习状态持久化，供复习页/云同步读取；并记一次"今天有学习活动"
  useEffect(() => {
    if (phase === "ready" && graph && result) {
      saveProject({ goal: result.goal, points: result.points, state, updatedAt: Date.now() });
      setStreak(touchStreak());
    }
  }, [phase, graph, result, state]);

  const view = graph ? buildView(graph, state) : null;
  const layout = graph ? layeredLayout(graph) : null;

  const run = useCallback(async (g: string) => {
    const goalText = g.trim();
    if (!goalText) return;
    setErr(null);
    if (!getDeriveUrl()) {
      setErr("还没配置倒推端点 —— 见下方「设置」，本地启动 serve.py 即可。");
      return;
    }
    setGoal(goalText);
    setPhase("loading");
    try {
      const res = await deriveGraph(goalText);
      setResult(res);
      setGraph(new KnowledgeGraph(res.points));
      setState(emptyState());
      setDiagnosing(false);
      setDxQ(null);
      setOpenNode(null);
      setPhase("ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "倒推失败";
      setErr(msg === "NO_ENDPOINT" ? "还没配置倒推端点（见下方设置）。" : msg);
      setPhase("idle");
    }
  }, []);

  const reset = () => {
    setPhase("idle");
    setGraph(null);
    setResult(null);
    setErr(null);
    setDiagnosing(false);
    setDxQ(null);
    setOpenNode(null);
    clearProject();
  };

  const onLearned = useCallback(
    (id: string, correct: boolean, grade: number) => {
      setState((prev) => {
        const next: LearnerState = JSON.parse(JSON.stringify(prev));
        if (graph) recordResult(graph, next, id, correct, grade);
        return next;
      });
    },
    [graph],
  );

  const startDx = () => {
    if (!graph) return;
    setDiagnosing(true);
    setDxPhase("intro");
    setDxErr(null);
  };

  // 跳过没有探针的节点，返回下一个有诊断题、信息量最大的节点
  const nextProbe = (d: Diagnosis): string | null => {
    for (;;) {
      const q = d.nextQuestion();
      if (q === null) return null;
      if (probesRef.current[q]) return q;
      d.asked.add(q);
    }
  };

  const beginProbe = async () => {
    if (!graph || !result) return;
    setDxPhase("loading");
    setDxErr(null);
    try {
      const pts = graph.ids().map((id) => ({
        id,
        name: graph.get(id).name,
        domain: graph.get(id).domain,
      }));
      probesRef.current = await generateProbes(pts, result.goal);
      const d = new Diagnosis(graph, 14);
      dxRef.current = d;
      setDxCount(0);
      setDxChoice(null);
      setDxConf(null);
      setDxQ(nextProbe(d));
      setDxPhase("asking");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "出题失败";
      setDxErr(msg === "NO_ENDPOINT" ? "诊断需要端点（与倒推同源，启动 serve.py 即可）。" : msg);
      setDxPhase("intro");
    }
  };

  const applyDx = (d: Diagnosis) => {
    if (graph) setState(stateFromDiagnosis(d, graph));
    setDiagnosing(false);
    setDxQ(null);
  };

  const submitProbe = () => {
    const d = dxRef.current;
    if (!d || !dxQ || dxChoice === null || !dxConf) return;
    const correct = dxChoice === probesRef.current[dxQ].answer;
    d.answerConf(dxQ, correct, dxConf);
    setDxCount(d.asked.size);
    setDxChoice(null);
    setDxConf(null);
    const q = nextProbe(d);
    if (q === null) applyDx(d);
    else setDxQ(q);
  };

  const saveCfg = () => {
    setDeriveUrl(urlDraft);
    setCfgUrl(urlDraft.trim());
  };

  return (
    <>
      <SiteHeader />
      <div className="wrap">
        <section>
          <div className="shead">
            <span className="no">01</span>
            <h2>倒推</h2>
            <span className="sub">goal → knowledge graph</span>
          </div>
          {phase === "ready" && graph && view && layout && result
            ? renderResult()
            : renderIntro()}
        </section>
      </div>
      <footer>
        <div className="wrap">TELOS — 从结果倒推，学会任何事 · 开源 Demo</div>
      </footer>
      {openNode && graph && view && graph.get(openNode) && (
        <NodePanel
          graph={graph}
          view={view}
          state={state}
          pid={openNode}
          goal={result?.goal ?? goal}
          onClose={() => setOpenNode(null)}
          onLearned={onLearned}
          onOpenNode={setOpenNode}
        />
      )}
    </>
  );

  function renderIntro() {
    return (
      <div className={styles.intro}>
        <div>
          <div className={styles.eye}>从结果倒推</div>
          <h1 className={styles.h2}>
            说出你的目标，
            <br />
            看它拆成一张学习地图
          </h1>
          <p className={styles.lede}>
            输入任意目标 —— 写代码、跑马拉松、看财报、学乐器都行。引擎用逆向设计把它拆成带前置依赖的知识点
            DAG，并标出你现在该从哪里开始。
          </p>
          <div className={styles.box}>
            <textarea
              className={styles.txt}
              rows={3}
              placeholder="例如：用 FastAPI 写一个带 JWT 鉴权的 REST API 并部署上线"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(goal);
              }}
            />
            <div className={styles.bar}>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                Telos engine · Cmd/Ctrl+Enter
              </span>
              <button
                className={`btn btn-ink ${styles.go}`}
                onClick={() => run(goal)}
                disabled={phase === "loading"}
              >
                倒推 <Icon name="arrow" />
              </button>
            </div>
          </div>

          {phase === "loading" && (
            <div className={styles.loading}>
              <span className={styles.spin} />
              正在倒推「{goal}」…（首次约 10–20 秒）
            </div>
          )}
          {err && <div className={styles.err}>{err}</div>}

          <div className={styles.chips}>
            <span className={styles.chipsLabel}>试试这些</span>
            {EXAMPLES.map((e) => (
              <button
                key={e}
                className={styles.chip}
                onClick={() => {
                  setGoal(e);
                  run(e);
                }}
              >
                <i />
                {e}
              </button>
            ))}
          </div>

          {mounted && (
            <div className={styles.cfg}>
              <div className={styles.cfgTop}>
                <span className={`${styles.dot} ${cfgUrl ? styles.dotOk : styles.dotOff}`} />
                {cfgUrl ? "已配置倒推服务" : "未配置倒推服务（设置后即可体验）"}
              </div>
              <div className={styles.cfgBody}>
                {cfgUrl ? (
                  <>
                    端点：<code>{cfgUrl}</code>
                  </>
                ) : (
                  <>
                    本地体验三步：① <code>cd core</code> ② <code>python3 serve.py</code> ③ 把端点填成{" "}
                    <code>http://127.0.0.1:8787/derive</code> 并保存。
                  </>
                )}
                <div className={styles.cfgRow}>
                  <input
                    className={styles.cfgInput}
                    placeholder="http://127.0.0.1:8787/derive"
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                  />
                  <button className={styles.cfgSave} onClick={saveCfg}>
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className={styles.art}>
          <div className={styles.artH}>倒推怎么工作</div>
          <div className={styles.flow}>
            {[
              ["你给一个目标", "一句话，任何领域都行"],
              ["LLM 逆向设计", "拆成带前置依赖的知识点 DAG"],
              ["引擎标出学习前沿", "知识空间理论算出你现在能学的"],
              ["诊断 + 间隔复习带你走完", "BKT 测起点，FSRS 防遗忘"],
            ].map(([t, s], i) => (
              <div className={styles.fstep} key={i}>
                <span className={styles.fnum}>{i + 1}</span>
                <div className={styles.fbody}>
                  <b>{t}</b>
                  <span>{s}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    );
  }

  function renderResult() {
    const totalMin = result!.points.reduce((s, p) => s + (p.minutes ?? 0), 0);
    const dur =
      totalMin >= 60 ? `约 ${(totalMin / 60).toFixed(totalMin % 60 ? 1 : 0)} 小时` : `约 ${totalMin} 分钟`;
    const ordered = Object.values(layout!.nodes)
      .sort((a, b) => a.layer - b.layer || a.y - b.y)
      .map((n) => n.id);

    return (
      <>
        <div className={styles.cap}>
          <span>知识图谱</span>
          <span>
            {view!.total} 个知识点 · {dur}
          </span>
          <span className={styles.reset} onClick={reset}>
            ↺ 换个目标
          </span>
        </div>
        <div className={styles.plate}>
          <div className={styles.rtop}>
            <div className={styles.rgoal}>
              {result!.goal}
              <span>
                Telos 倒推 ·{" "}
                {diagnosing
                  ? "诊断中…"
                  : view!.mastered > 0
                    ? `已掌握 ${view!.mastered}/${view!.total}`
                    : "从入口节点开始，或先测一测起点"}
              </span>
            </div>
            <div className={styles.leg}>
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

          {diagnosing ? (
            <div className={styles.diag}>{renderDiag()}</div>
          ) : (
            <div className={styles.body}>
              {renderCanvas()}
              {renderAside(ordered)}
            </div>
          )}
        </div>
      </>
    );
  }

  function renderCanvas() {
    return (
      <div className={styles.canvasCell}>
        {isPhone ? (
          <PathView graph={graph!} view={view!} onOpenNode={setOpenNode} />
        ) : (
          <DeriveCanvas graph={graph!} view={view!} onOpenNode={setOpenNode} />
        )}
      </div>
    );
  }

  function renderAside(ordered: string[]) {
    return (
      <div className={styles.aside}>
        <h4>你的进度</h4>
        <div className={styles.statRow}>
          <div className={styles.big}>
            {view!.mastered}
            <sup> / {view!.total}</sup>
          </div>
          <div className={styles.statSub}>
            个知识点
            <br />
            已掌握
          </div>
        </div>
        <div className={styles.bar2}>
          <i style={{ width: `${view!.pct}%` }} />
        </div>
        <div className={styles.statSub}>按当前节奏 · 预计 {view!.etaDays} 天达成</div>
        <div className={styles.xpRow}>
          <span className={styles.xpItem}>
            <Icon name="spark" style={{ width: 13, height: 13, verticalAlign: -2, marginRight: 4 }} />
            {computeXp(graph!, state)} XP
          </span>
          {streak > 0 && <span className={styles.xpItem}>连胜 {streak} 天</span>}
        </div>

        {view!.next && (
          <div className={`dark ${styles.next}`}>
            <div className={styles.l}>{view!.mastered > 0 ? "推荐下一步" : "从这里开始"}</div>
            <div className={styles.t}>{view!.next.name}</div>
            <div className={styles.d}>
              {view!.mastered > 0
                ? "前置已全部掌握，正处你的学习前沿。"
                : "它没有前置，是这张图的入口之一。"}{" "}
              约 {view!.next.minutes} 分钟。
            </div>
          </div>
        )}

        <button className={`btn btn-ink ${styles.dxBtn}`} onClick={startDx}>
          <Icon name="spark" /> {view!.mastered > 0 ? "重新测一测起点" : "测一测我的起点"}
        </button>

        <div className={styles.steps}>
          <h4 style={{ marginTop: 4 }}>学习顺序</h4>
          {ordered.map((id, i) => (
            <div key={id} className={styles.step}>
              <span className={styles.si}>{String(i + 1).padStart(2, "0")}</span>
              <b>{graph!.get(id).name}</b>
              <span className={styles.stepDomain}>{domainLabel(graph!.get(id).domain)}</span>
              <span className="sm">{view!.sub[id]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderDiag() {
    if (dxPhase === "intro") {
      return (
        <div className={styles.diagIntro}>
          <h3>测一测你的起点</h3>
          <p>
            这不是考试。几道题帮我搞清楚你已经会哪些，好<b>跳过会的、直接学不会的</b>
            。答错完全没关系——错得越清楚，我定位越准。每题答完再选一下「有多大把握」，自信地答错比蒙对更说明问题。
          </p>
          {dxErr && <div className={styles.drawerErr}>{dxErr}</div>}
          <div className={styles.diagIntroBtns}>
            <button className="btn btn-ink" onClick={beginProbe}>
              开始（{Math.min(graph!.ids().length, 14)} 题内）
            </button>
            <button className="btn btn-line" onClick={() => setDiagnosing(false)}>
              取消
            </button>
          </div>
        </div>
      );
    }
    if (dxPhase === "loading") {
      return (
        <div className={styles.loading}>
          <span className={styles.spin} /> 正在为「{result!.goal}」出诊断题…（一次性，稍候）
        </div>
      );
    }
    const probe = dxQ ? probesRef.current[dxQ] : null;
    if (!probe) return null;
    return (
      <>
        <div className={styles.diagHead}>
          <h3>诊断 · {graph!.get(dxQ!).name}</h3>
          <span className={styles.prog}>已答 {dxCount} 题</span>
        </div>
        <p className={styles.checkQ}>{probe.q}</p>
        <div className={styles.opts}>
          {probe.options.map((o, i) => (
            <button
              key={i}
              className={`${styles.opt} ${dxChoice === i ? styles.optSel : ""}`}
              onClick={() => setDxChoice(i)}
            >
              <span className={styles.optMark}>{String.fromCharCode(65 + i)}</span>
              {o}
            </button>
          ))}
        </div>
        <div className={styles.confRow}>
          <span className={styles.confLabel}>你多有把握？</span>
          {([
            ["low", "不太"],
            ["mid", "一般"],
            ["high", "很有把握"],
          ] as const).map(([v, l]) => (
            <button
              key={v}
              className={`${styles.confBtn} ${dxConf === v ? styles.confSel : ""}`}
              onClick={() => setDxConf(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className={styles.lessonActions}>
          <button
            className="btn btn-ink"
            style={{ flex: 1, justifyContent: "center" }}
            disabled={dxChoice === null || !dxConf}
            onClick={submitProbe}
          >
            下一题
          </button>
          <button className="btn btn-line" onClick={() => dxRef.current && applyDx(dxRef.current)}>
            结束看结果
          </button>
        </div>
      </>
    );
  }
}
