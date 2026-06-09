"use client";

// 节点详情 sheet + 「开始学习」。详情(渐进披露) → start → 生成微课 → 交给 LessonRunner 跑
// 交互式分步状态机；判分回填 onLearned(FIRe+FSRS)。挑战(OLM)：我其实会，考一道直接判掌握。
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import styles from "./app.module.css";
import { AGAIN, GOOD, KnowledgeGraph, type LearnerState, domainLabel } from "@/lib/telos/engine";
import type { LearnerView } from "@/lib/telos/store";
import { engineReady, generateLesson, generateProbes, type Lesson, type Probe } from "@/lib/telos/derive";
import LessonRunner from "@/components/lesson-runner";
import { TierText } from "@/components/tier-text";
import { useT } from "@/lib/telos/i18n";

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
  const { t } = useT();
  const [phase, setPhase] = useState<Phase>("detail");
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [startPct, setStartPct] = useState(0);
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
  const lessonReady = engineReady();
  const drill = (node.drill ?? "").trim();
  const benchmark = (node.benchmark ?? "").trim();
  const dom = domainLabel(node.domain, t);
  const desc =
    (node.desc ?? "").trim() ||
    (node.isGoal
      ? t("np.descGoal", { domain: dom })
      : unlocks.length
        ? t("np.descUnlocks", {
            domain: dom,
            list: unlocks.slice(0, 3).join(", ") + (unlocks.length > 3 ? t("np.listMore") : ""),
          })
        : t("np.descPlain", { domain: dom }));

  async function start() {
    setErr(null);
    setPhase("loading");
    setStartPct(pct);
    try {
      const l = await generateLesson({
        name: node.name,
        domain: node.domain,
        prereqs: prereqs.filter((p) => p.done).map((p) => p.name),
        goal,
      });
      setLesson(l);
      setPhase("lesson");
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("err.deriveFailed");
      setErr(msg === "NO_ENDPOINT" ? t("err.noEndpointLesson") : msg);
      setPhase("detail");
    }
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
      const msg = e instanceof Error ? e.message : t("err.probeFailed");
      setErr(msg === "NO_ENDPOINT" ? t("err.noEndpointProbe") : msg);
      setPhase("detail");
    }
  }
  function submitChallenge() {
    if (chChoice === null || !chProbe) return;
    setChSubmitted(true);
    onLearned(pid, chChoice === chProbe.answer, chChoice === chProbe.answer ? GOOD : AGAIN);
  }

  // ═══════ 全屏交互式微课 ═══════
  if (phase === "lesson" && lesson) {
    return (
      <LessonRunner
        lesson={lesson}
        nodeName={node.name}
        domainText={domainLabel(node.domain, t)}
        unlocks={unlocks}
        goal={goal}
        masteryPct={pct}
        startPct={startPct}
        drill={drill}
        benchmark={benchmark}
        onGrade={(correct) => onLearned(pid, correct, correct ? GOOD : AGAIN)}
        onClose={onClose}
      />
    );
  }

  // ═══════ 详情 / 加载 / 挑战 sheet ═══════
  return (
    <>
      <div className={styles.scrim} onClick={onClose} />
      <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`知识点：${node.name}`}>
        <div className={styles.drawerHead}>
          <span className={styles.drawerBadge}>{domainLabel(node.domain, t)}</span>
          <button className={styles.drawerClose} onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {phase === "challenge" ? (
          <div className={styles.lessonBody}>
            <h3 className={styles.drawerName}>{node.name}</h3>
            <div className={styles.lessonSec}>
              <div className={styles.lessonLabel}>{t("np.challengeTitle")}</div>
              {!chProbe ? (
                <div className={styles.loading}>
                  <span className={styles.spin} /> {t("np.generatingQ")}
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
                      {t("np.submit")}
                    </button>
                  ) : (
                    <>
                      <div className={chChoice === chProbe.answer ? styles.outcomeOk : styles.outcomeNo}>
                        {chChoice === chProbe.answer ? (
                          <>
                            <Icon name="check" style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 4 }} />
                            {t("np.confirmedMastery")}
                          </>
                        ) : (
                          t("np.needLearn")
                        )}
                        {chProbe.rationale && <span> {chProbe.rationale}</span>}
                      </div>
                      <div className={styles.lessonActions}>
                        <button className={`btn btn-ink ${styles.lessonBtn}`} onClick={onClose}>
                          {t("np.done")}
                        </button>
                        {chChoice !== chProbe.answer && (
                          <button className={`btn btn-line ${styles.lessonBtn}`} onClick={start}>
                            {t("np.goLearn")}
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
              {node.isGoal && (
                <span className={styles.star}>
                  <Icon name="target" style={{ width: 16, height: 16 }} />
                </span>
              )}
              {node.name}
            </h3>
            <div className={styles.detailMeta}>
              {node.moduleTitle && <span className={styles.modChip}>{node.moduleTitle}</span>}
              <span className={`${styles.statusPill} ${styles[`pill_${status}`]}`}>{view.sub[pid]}</span>
              {status === "learn" && <span className={styles.metaDim}>{t("np.masteryPct", { pct })}</span>}
              <span className={styles.metaDim}>{t("np.minutes", { min: node.minutes ?? 25 })}</span>
            </div>

            <p className={styles.detailDesc}>{desc}</p>

            {err && <div className={styles.drawerErr}>{err}</div>}

            {ready ? (
              <button
                className={`btn btn-ink ${styles.startBtn}`}
                onClick={start}
                disabled={phase === "loading" || !lessonReady}
              >
                {phase === "loading" ? t("np.generatingLesson") : status === "done" ? t("np.relearn") : t("home.startLearn")}{" "}
                {phase !== "loading" && <Icon name="arrow" />}
              </button>
            ) : (
              <div className={styles.lockNote}>
                <Icon name="lock" style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 5 }} />
                {t("np.locked")}
              </div>
            )}
            {!lessonReady && (
              <div className={styles.metaDim} style={{ marginTop: 8 }}>
                {t("np.needEndpoint")}
              </div>
            )}

            {status !== "done" && lessonReady && (
              <button className={styles.olmLink} onClick={challenge}>
                {t("np.olm")}
              </button>
            )}

            {drill && (
              <div className={styles.detailSec}>
                <div className={styles.detailH}>{t("np.howToPractice")}</div>
                <TierText text={drill} className={styles.unlockList} />
              </div>
            )}

            {benchmark && (
              <div className={styles.detailSec}>
                <div className={styles.detailH}>{t("np.benchmark")}</div>
                <TierText text={benchmark} className={styles.unlockList} />
              </div>
            )}

            {prereqs.length > 0 && (
              <div className={styles.detailSec}>
                <div className={styles.detailH}>{t("np.prereqs")}</div>
                {prereqs.map((p) => (
                  <button key={p.id} className={styles.preRow} onClick={() => onOpenNode(p.id)}>
                    <span>
                      {p.done ? (
                        <Icon name="check" style={{ width: 13, height: 13, verticalAlign: -1 }} />
                      ) : (
                        "○"
                      )}
                    </span>
                    <b>{p.name}</b>
                    <span className={styles.metaDim}>{p.done ? t("word.mastered") : `${p.pct}%`}</span>
                  </button>
                ))}
              </div>
            )}

            {unlocks.length > 0 && (
              <div className={styles.detailSec}>
                <div className={styles.detailH}>{t("np.unlocks")}</div>
                <div className={styles.unlockList}>{unlocks.join(" · ")}</div>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
