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
  review,
  usesFsrs,
} from "@/lib/telos/engine";
import { buildView } from "@/lib/telos/store";
import { layeredLayout } from "@/lib/telos/layout";
import { deriveGraph, getDeriveUrl, setDeriveUrl, type DerivedGraph } from "@/lib/telos/derive";

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
  const [diagnosing, setDiagnosing] = useState(false);
  const [dxQ, setDxQ] = useState<string | null>(null);
  const [dxCount, setDxCount] = useState(0);

  useEffect(() => {
    setMounted(true);
    const u = getDeriveUrl();
    setCfgUrl(u);
    setUrlDraft(u);
  }, []);

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
  };

  const startDx = () => {
    if (!graph) return;
    const d = new Diagnosis(graph);
    dxRef.current = d;
    setDiagnosing(true);
    setDxCount(0);
    setDxQ(d.nextQuestion());
  };
  const applyDx = (d: Diagnosis) => {
    if (graph) setState(stateFromDiagnosis(d, graph));
    setDiagnosing(false);
    setDxQ(null);
  };
  const answerDx = (correct: boolean) => {
    const d = dxRef.current;
    if (!d || !dxQ) return;
    d.answer(dxQ, correct);
    setDxCount(d.asked.size);
    const q = d.nextQuestion();
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
        <DeriveCanvas graph={graph!} view={view!} />
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
    const name = dxQ ? graph!.get(dxQ).name : "";
    return (
      <>
        <div className={styles.diagHead}>
          <h3>快速诊断</h3>
          <span className={styles.prog}>已答 {dxCount} 题</span>
        </div>
        <div className={styles.q}>
          <div className={styles.qLabel}>你会这个吗？</div>
          <div className={styles.qName}>{name}</div>
          <div className={styles.qHint}>
            凭直觉作答即可 —— 引擎用贝叶斯知识追踪（BKT）+ 信息增益，从最少的问题里推断你其它知识点的掌握度。
          </div>
          <div className={styles.qbtns}>
            <button className={styles.yes} onClick={() => answerDx(true)}>
              会 ✓
            </button>
            <button onClick={() => answerDx(false)}>不会</button>
          </div>
        </div>
        <button className={styles.diagSkip} onClick={() => dxRef.current && applyDx(dxRef.current)}>
          结束诊断，看结果 →
        </button>
      </>
    );
  }
}
