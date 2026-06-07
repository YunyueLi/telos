"use client";

// 节点详情抽屉 + 「开始学习」微课流程。
// 详情(渐进披露) → 开始学习 → LLM 微课(讲解+范例+检查题) → 判分回填 record(FIRe+FSRS)。
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import styles from "./derive.module.css";
import { AGAIN, GOOD, KnowledgeGraph, type LearnerState, domainLabel } from "@/lib/telos/engine";
import type { LearnerView } from "@/lib/telos/store";
import { generateLesson, generateProbes, getLessonUrl, type Lesson, type Probe } from "@/lib/telos/derive";

type Phase = "detail" | "loading" | "lesson" | "challenge";

export default function NodePanel({
  graph,
  view,
  state,
  pid,
  goal,
  onClose,
  onLearned,
  onOpenNode,
}: {
  graph: KnowledgeGraph;
  view: LearnerView;
  state: LearnerState;
  pid: string;
  goal: string;
  onClose: () => void;
  onLearned: (id: string, correct: boolean, grade: number) => void;
  onOpenNode: (id: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("detail");
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  // 开放学习者模型：用户挑战"我其实会"
  const [chProbe, setChProbe] = useState<Probe | null>(null);
  const [chChoice, setChChoice] = useState<number | null>(null);
  const [chSubmitted, setChSubmitted] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const node = graph.get(pid);
  const status = view.visual[pid];
  const pct = Math.round((state.mastery[pid] ?? 0) * 100);
  const ready = status !== "lock";
  const prereqs = graph.prerequisites(pid).map((id) => ({
    id,
    name: graph.get(id).name,
    done: view.visual[id] === "done",
    pct: Math.round((state.mastery[id] ?? 0) * 100),
  }));
  const unlocks = graph.dependents(pid).map((id) => graph.get(id).name);
  const lessonReady = !!getLessonUrl();
  const desc =
    (node.desc ?? "").trim() ||
    `${domainLabel(node.domain)}类知识点${
      node.isGoal
        ? "，是这条学习路径的最终目标。"
        : unlocks.length
          ? `，掌握后会解锁 ${unlocks.slice(0, 3).join("、")}${unlocks.length > 3 ? " 等" : ""}。`
          : "。"
    }`;

  async function start() {
    setErr(null);
    setPhase("loading");
    try {
      const l = await generateLesson({
        name: node.name,
        domain: node.domain,
        prereqs: prereqs.filter((p) => p.done).map((p) => p.name),
        goal,
      });
      setLesson(l);
      setChoice(null);
      setSubmitted(false);
      setPhase("lesson");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成失败";
      setErr(msg === "NO_ENDPOINT" ? "未配置微课端点（与倒推端点同源，启动 serve.py 即可）。" : msg);
      setPhase("detail");
    }
  }

  function submit() {
    if (choice === null || !lesson) return;
    const correct = choice === lesson.check.answer;
    setSubmitted(true);
    onLearned(pid, correct, correct ? GOOD : AGAIN);
  }

  async function challenge() {
    setErr(null);
    setChProbe(null);
    setChChoice(null);
    setChSubmitted(false);
    setPhase("challenge");
    try {
      const ps = await generateProbes([{ id: pid, name: node.name, domain: node.domain }], goal);
      setChProbe(ps[pid] ?? Object.values(ps)[0]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "出题失败";
      setErr(msg === "NO_ENDPOINT" ? "需要端点（启动 serve.py 即可）。" : msg);
      setPhase("detail");
    }
  }
  function submitChallenge() {
    if (chChoice === null || !chProbe) return;
    setChSubmitted(true);
    onLearned(pid, chChoice === chProbe.answer, chChoice === chProbe.answer ? GOOD : AGAIN);
  }

  const correct = submitted && lesson ? choice === lesson.check.answer : false;

  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-label={`知识点：${node.name}`}>
        <div className={styles.drawerHead}>
          <span className={styles.drawerBadge}>{domainLabel(node.domain)}</span>
          <button className={styles.drawerClose} onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {phase === "lesson" && lesson ? (
          <div className={styles.lessonBody}>
            <h3 className={styles.drawerName}>{node.name}</h3>
            <div className={styles.lessonSec}>
              <div className={styles.lessonLabel}>一句话讲清</div>
              <p>{lesson.explain}</p>
            </div>
            {lesson.worked.problem && (
              <div className={styles.lessonSec}>
                <div className={styles.lessonLabel}>跟着做一遍</div>
                <p className={styles.workedProblem}>{lesson.worked.problem}</p>
                <ol className={styles.workedSteps}>
                  {lesson.worked.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
            <div className={styles.lessonSec}>
              <div className={styles.lessonLabel}>检验一下 —— 答对就算掌握</div>
              <p className={styles.checkQ}>{lesson.check.q}</p>
              <div className={styles.opts}>
                {lesson.check.options.map((o, i) => {
                  const isAns = i === lesson.check.answer;
                  const cls = [
                    styles.opt,
                    submitted && isAns ? styles.optRight : "",
                    submitted && choice === i && !isAns ? styles.optWrong : "",
                    !submitted && choice === i ? styles.optSel : "",
                  ].join(" ");
                  return (
                    <button key={i} className={cls} disabled={submitted} onClick={() => setChoice(i)}>
                      <span className={styles.optMark}>{String.fromCharCode(65 + i)}</span>
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>

            {!submitted ? (
              <button className={`btn btn-ink ${styles.lessonBtn}`} disabled={choice === null} onClick={submit}>
                提交答案
              </button>
            ) : (
              <>
                <div className={correct ? styles.outcomeOk : styles.outcomeNo}>
                  {correct ? "掌握了！" : "还差一点。"}
                  {lesson.check.rationale && <span> {lesson.check.rationale}</span>}
                </div>
                {correct && unlocks.length > 0 && (
                  <div className={styles.unlockMsg}>已解锁：{unlocks.join("、")}</div>
                )}
                <div className={styles.lessonActions}>
                  <button className={`btn btn-ink ${styles.lessonBtn}`} onClick={onClose}>
                    完成
                  </button>
                  {!correct && (
                    <button className={`btn btn-line ${styles.lessonBtn}`} onClick={start}>
                      换一道再试
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : phase === "challenge" ? (
          <div className={styles.lessonBody}>
            <h3 className={styles.drawerName}>{node.name}</h3>
            <div className={styles.lessonSec}>
              <div className={styles.lessonLabel}>考你一道 —— 答对就直接标记掌握</div>
              {!chProbe ? (
                <div className={styles.loading}>
                  <span className={styles.spin} /> 正在出题…
                </div>
              ) : (
                <>
                  <p className={styles.checkQ}>{chProbe.q}</p>
                  <div className={styles.opts}>
                    {chProbe.options.map((o, i) => {
                      const isAns = i === chProbe.answer;
                      const cls = [
                        styles.opt,
                        chSubmitted && isAns ? styles.optRight : "",
                        chSubmitted && chChoice === i && !isAns ? styles.optWrong : "",
                        !chSubmitted && chChoice === i ? styles.optSel : "",
                      ].join(" ");
                      return (
                        <button key={i} className={cls} disabled={chSubmitted} onClick={() => setChChoice(i)}>
                          <span className={styles.optMark}>{String.fromCharCode(65 + i)}</span>
                          {o}
                        </button>
                      );
                    })}
                  </div>
                  {!chSubmitted ? (
                    <button
                      className={`btn btn-ink ${styles.lessonBtn}`}
                      disabled={chChoice === null}
                      onClick={submitChallenge}
                    >
                      提交
                    </button>
                  ) : (
                    <>
                      <div className={chChoice === chProbe.answer ? styles.outcomeOk : styles.outcomeNo}>
                        {chChoice === chProbe.answer ? "已确认掌握 ✓" : "看来还需要学一下。"}
                        {chProbe.rationale && <span> {chProbe.rationale}</span>}
                      </div>
                      <div className={styles.lessonActions}>
                        <button className={`btn btn-ink ${styles.lessonBtn}`} onClick={onClose}>
                          完成
                        </button>
                        {chChoice !== chProbe.answer && (
                          <button className={`btn btn-line ${styles.lessonBtn}`} onClick={start}>
                            去学一下
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.detailBody}>
            <h3 className={styles.drawerName}>
              {node.isGoal && <span className={styles.star}>★</span>}
              {node.name}
            </h3>
            <div className={styles.detailMeta}>
              <span className={`${styles.statusPill} ${styles[`pill_${status}`]}`}>{view.sub[pid]}</span>
              {status === "learn" && <span className={styles.metaDim}>掌握度 {pct}%</span>}
              <span className={styles.metaDim}>⏱ 约 {node.minutes ?? 25} 分钟</span>
            </div>

            <p className={styles.detailDesc}>{desc}</p>

            {err && <div className={styles.drawerErr}>{err}</div>}

            {ready ? (
              <button
                className={`btn btn-ink ${styles.startBtn}`}
                onClick={start}
                disabled={phase === "loading" || !lessonReady}
              >
                {phase === "loading" ? "正在生成微课…" : "开始学习"} {phase !== "loading" && <Icon name="arrow" />}
              </button>
            ) : (
              <div className={styles.lockNote}>🔒 未解锁 · 先学完下面的前置</div>
            )}
            {!lessonReady && (
              <div className={styles.metaDim} style={{ marginTop: 8 }}>
                （微课需启动 serve.py / 配置端点，与倒推同源）
              </div>
            )}

            {status !== "done" && lessonReady && (
              <button className={styles.olmLink} onClick={challenge}>
                我其实已经会了，考我一下 →
              </button>
            )}

            {prereqs.length > 0 && (
              <div className={styles.detailSec}>
                <div className={styles.detailH}>前置</div>
                {prereqs.map((p) => (
                  <button key={p.id} className={styles.preRow} onClick={() => onOpenNode(p.id)}>
                    <span>{p.done ? "✓" : "○"}</span>
                    <b>{p.name}</b>
                    <span className={styles.metaDim}>{p.done ? "已掌握" : `${p.pct}%`}</span>
                  </button>
                ))}
              </div>
            )}

            {unlocks.length > 0 && (
              <div className={styles.detailSec}>
                <div className={styles.detailH}>学会它能解锁</div>
                <div className={styles.unlockList}>{unlocks.join(" · ")}</div>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
