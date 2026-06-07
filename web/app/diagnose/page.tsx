"use client";

// 起点诊断（全屏接管）：基于真实项目图谱，用信息增益选题 + CBM 信心加权折进 BKT，
// "找到你的起点"框架，结果页给出「从 Y 开始、跳过 N 个已会的」。替换粗糙的会/不会。
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { useProject } from "@/lib/telos/use-project";
import {
  Diagnosis,
  GOOD,
  type LearnerState,
  emptyState,
  learningFrontier,
  newCard,
  review,
  usesFsrs,
} from "@/lib/telos/engine";
import { generateProbes, type Probe } from "@/lib/telos/derive";
import { useT } from "@/lib/telos/i18n";

type Phase = "intro" | "loading" | "asking" | "result";
const CONF: ["low" | "mid" | "high", string][] = [
  ["low", "dx.confLow"],
  ["mid", "dx.confMid"],
  ["high", "dx.confHigh"],
];

export default function DiagnosePage() {
  const router = useRouter();
  const { ready, project, graph, applyState } = useProject();
  const { t } = useT();

  const dxRef = useRef<Diagnosis | null>(null);
  const probesRef = useRef<Record<string, Probe>>({});
  // 每题作答记录：用于结果页的正确率 + 错题解析
  const answersRef = useRef<
    { name: string; q: string; options: string[]; answer: number; chosen: number; correct: boolean; rationale: string }[]
  >([]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [conf, setConf] = useState<"low" | "mid" | "high" | null>(null);
  const [summary, setSummary] = useState<
    { located: number; known: number; start: string; answered: number; correctN: number; rate: number } | null
  >(null);

  useEffect(() => {
    if (ready && !project) router.replace("/");
  }, [ready, project, router]);

  if (!ready || !project || !graph) {
    return (
      <div className="dx">
        <div className="loadrow" style={{ flex: 1, justifyContent: "center" }}>
          <span className="spinner" /> {t("common.loading")}
        </div>
      </div>
    );
  }

  const total = graph.ids().length;
  const max = Math.min(total, 14);

  function nextProbe(d: Diagnosis): string | null {
    for (;;) {
      const x = d.nextQuestion();
      if (x === null) return null;
      if (probesRef.current[x]) return x;
      d.asked.add(x);
    }
  }

  async function begin() {
    if (!graph || !project) return;
    setPhase("loading");
    setErr(null);
    try {
      const pts = graph.ids().map((id) => ({
        id,
        name: graph.get(id).name,
        domain: graph.get(id).domain,
      }));
      probesRef.current = await generateProbes(pts, project.goal);
      const d = new Diagnosis(graph, 14);
      dxRef.current = d;
      answersRef.current = [];
      setCount(0);
      setChoice(null);
      setConf(null);
      setQ(nextProbe(d));
      setPhase("asking");
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("err.probeFailed");
      setErr(msg === "NO_ENDPOINT" ? t("err.noEndpointDiagnose") : msg);
      setPhase("intro");
    }
  }

  function finish(d: Diagnosis) {
    if (!graph) return;
    const s: LearnerState = emptyState();
    for (const id of graph.ids()) s.mastery[id] = d.belief[id] >= 0.6 ? 0.9 : d.belief[id];
    for (const id of graph.ids())
      if (d.belief[id] >= 0.6 && usesFsrs(graph.get(id).domain)) s.cards[id] = review(newCard(), GOOD, 0);
    s.version += 1;
    applyState(s);

    const known = graph.ids().filter((id) => d.belief[id] >= 0.6).length;
    const f = learningFrontier(graph, s)[0];
    const start = f ? graph.get(f[0]).name : "—";
    const ans = answersRef.current;
    const correctN = ans.filter((a) => a.correct).length;
    const rate = ans.length ? Math.round((correctN / ans.length) * 100) : 0;
    setSummary({ located: d.asked.size, known, start, answered: ans.length, correctN, rate });
    setPhase("result");
  }

  function submit() {
    const d = dxRef.current;
    if (!d || !q || choice === null || !conf || !graph) return;
    const probe = probesRef.current[q];
    const correct = choice === probe.answer;
    answersRef.current.push({
      name: graph.get(q).name,
      q: probe.q,
      options: probe.options,
      answer: probe.answer,
      chosen: choice,
      correct,
      rationale: probe.rationale,
    });
    d.answerConf(q, correct, conf);
    setCount(d.asked.size);
    setChoice(null);
    setConf(null);
    const nx = nextProbe(d);
    if (nx === null) finish(d);
    else setQ(nx);
  }

  const probe = q ? probesRef.current[q] : null;
  const pct = phase === "result" ? 100 : Math.round((count / max) * 100);

  return (
    <div className="dx">
      <div className="dx-top">
        <button className="close" onClick={() => router.push("/")} aria-label={t("common.close")}>
          ✕
        </button>
        <div className="dx-track">
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className="dx-n">
          {phase === "asking" ? t("dx.answered", { n: count }) : phase === "result" ? t("dx.complete") : t("dx.title")}
        </span>
      </div>

      <div className="dx-body">
        {phase === "intro" && (
          <div className="dx-intro">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="pcirc">
              <img src={asset("/portraits/think.png")} alt="Telos 老师" />
            </span>
            <h2>{t("dx.introTitle")}</h2>
            <p>{t("dx.introP1")}</p>
            <p>{t("dx.introP2")}</p>
            {err && <div className="errbox" style={{ marginTop: 8 }}>{err}</div>}
            <div className="dx-cta" style={{ marginTop: 22 }}>
              <button className="btn btn-ink" onClick={begin}>
                {t("dx.start", { max })} <Icon name="arrow" />
              </button>
              <button className="btn btn-line" onClick={() => router.push("/")}>
                {t("dx.later")}
              </button>
            </div>
          </div>
        )}

        {phase === "loading" && (
          <div className="loadrow" style={{ justifyContent: "center", paddingTop: 60 }}>
            <span className="spinner" /> {t("dx.loadingProbes", { goal: project.goal })}
          </div>
        )}

        {phase === "asking" && probe && q && (
          <>
            <div className="dx-topic">
              <Icon name="target" /> {t("dx.locating", { name: graph.get(q).name })}
            </div>
            <h3 className="dx-q">{probe.q}</h3>
            <div className="dx-opts">
              {probe.options.map((o, i) => (
                <button
                  key={i}
                  className={`dx-opt ${choice === i ? "sel" : ""}`}
                  onClick={() => setChoice(i)}
                >
                  <span className="mk">{String.fromCharCode(65 + i)}</span>
                  {o}
                </button>
              ))}
            </div>
            <div className="dx-conf">
              <span className="lab">{t("dx.confQ")}</span>
              {CONF.map(([v, l]) => (
                <button
                  key={v}
                  className={`dx-cbtn ${conf === v ? "sel" : ""}`}
                  onClick={() => setConf(v)}
                >
                  {t(l)}
                </button>
              ))}
            </div>
            <div className="dx-actions">
              <button className="btn btn-ink" disabled={choice === null || !conf} onClick={submit}>
                {t("dx.nextQ")}
              </button>
              <button
                className="btn btn-line"
                onClick={() => dxRef.current && finish(dxRef.current)}
              >
                {t("dx.endSee")}
              </button>
            </div>
          </>
        )}

        {phase === "result" && summary && (
          <div className="dx-result">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="pcirc">
              <img src={asset("/portraits/point.png")} alt="Telos 老师" />
            </span>
            <h2>{t("dx.resultTitle")}</h2>
            <p>
              {t("dx.resultP", {
                goal: project.goal,
                start: summary.start,
                skip: summary.known > 0 ? t("dx.resultSkip", { n: summary.known }) : "",
              })}
            </p>
            {summary.answered > 0 && (
              <div className="dx-score">
                <span className="big">{summary.rate}%</span>
                <span className="lab">
                  {t("dx.correctRate")} · {t("dx.answeredOf", { m: summary.correctN, n: summary.answered })}
                </span>
              </div>
            )}
            <div className="dx-sum">
              <div className="s">
                <span className="num">{summary.located}</span>
                <span className="lab">{t("dx.located")}</span>
              </div>
              <div className="s">
                <span className="num">{summary.known}</span>
                <span className="lab">{t("dx.judgedKnown")}</span>
              </div>
              <div className="s">
                <span className="num">{total - summary.known}</span>
                <span className="lab">{t("dx.toLearn")}</span>
              </div>
            </div>
            {answersRef.current.some((a) => !a.correct) && (
              <div className="dx-review">
                <div className="dx-review-h">{t("dx.wrongReview")}</div>
                {answersRef.current
                  .filter((a) => !a.correct)
                  .map((a, i) => (
                    <div key={i} className="dx-wrong">
                      <div className="dx-wq">{a.q}</div>
                      <div className="dx-wa">
                        {t("dx.correctAnswer")}：{String.fromCharCode(65 + a.answer)}. {a.options[a.answer]}
                      </div>
                      {a.rationale && <div className="dx-wr">{a.rationale}</div>}
                    </div>
                  ))}
              </div>
            )}
            <div className="dx-cta">
              <button className="btn btn-ink" onClick={() => router.push("/")}>
                {t("dx.goMap")} <Icon name="arrow" />
              </button>
              <button
                className="btn btn-line"
                onClick={() => {
                  setSummary(null);
                  setPhase("intro");
                }}
              >
                <Icon name="refresh" /> {t("dx.retest")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
