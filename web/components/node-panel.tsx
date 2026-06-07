"use client";

// 节点详情 sheet + 「开始学习」分步微课（全屏接管）。
// detail(渐进披露) → start → LLM 微课，按 讲解 / 跟着做 / 检验 分步走，
// 顶部进度条 + 底部主按钮 + 答错内联解释 + 完成显示掌握度增量。沿用 landing 05 设计语言。
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import styles from "./app.module.css";
import { AGAIN, GOOD, KnowledgeGraph, type LearnerState, domainLabel } from "@/lib/telos/engine";
import type { LearnerView } from "@/lib/telos/store";
import { generateLesson, generateProbes, getLessonUrl, type Lesson, type Probe } from "@/lib/telos/derive";

type Phase = "detail" | "loading" | "lesson" | "challenge";

// 把"课程名 + 平台"指向该平台的检索结果(LLM 只给名+平台，不编造 URL，搜名字最稳)。
function resourceUrl(name: string, platform: string): string {
  const q = encodeURIComponent(name);
  const p = (platform || "").toLowerCase();
  if (p.includes("youtube")) return `https://www.youtube.com/results?search_query=${q}`;
  if (p.includes("bili") || p.includes("b站") || p.includes("哔哩")) return `https://search.bilibili.com/all?keyword=${q}`;
  if (p.includes("coursera")) return `https://www.coursera.org/search?query=${q}`;
  if (p.includes("youku") || p.includes("优酷")) return `https://so.youku.com/search_video/q_${q}`;
  if (p.includes("mooc") || p.includes("中国大学")) return `https://www.icourse163.org/search.htm?search=${q}`;
  return `https://www.bing.com/search?q=${q}`;
}

const STEP_LABEL: Record<string, string> = { explain: "讲解", worked: "跟着做", check: "检验" };

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
  // 微课分步
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
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
  const lessonReady = !!getLessonUrl();
  const drill = (node.drill ?? "").trim();
  const benchmark = (node.benchmark ?? "").trim();
  const desc =
    (node.desc ?? "").trim() ||
    `${domainLabel(node.domain)}类能力${
      node.isGoal
        ? "，是这条学习路径的最终目标。"
        : unlocks.length
          ? `，掌握后会解锁 ${unlocks.slice(0, 3).join("、")}${unlocks.length > 3 ? " 等" : ""}。`
          : "。"
    }`;

  const steps = useMemo(() => {
    if (!lesson) return [] as string[];
    const s = ["explain"];
    if (lesson.worked?.problem) s.push("worked");
    s.push("check");
    return s;
  }, [lesson]);

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
      setStep(0);
      setChoice(null);
      setSubmitted(false);
      setPhase("lesson");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "生成失败";
      setErr(msg === "NO_ENDPOINT" ? "未配置微课端点（与倒推端点同源，到「我 · 设置」里填即可）。" : msg);
      setPhase("detail");
    }
  }

  function submitCheck() {
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
      setErr(msg === "NO_ENDPOINT" ? "需要端点（到「我 · 设置」里填即可）。" : msg);
      setPhase("detail");
    }
  }
  function submitChallenge() {
    if (chChoice === null || !chProbe) return;
    setChSubmitted(true);
    onLearned(pid, chChoice === chProbe.answer, chChoice === chProbe.answer ? GOOD : AGAIN);
  }

  // ═══════ 全屏分步微课 ═══════
  if (phase === "lesson" && lesson) {
    const stepKey = steps[step] ?? "check";
    const onCheck = stepKey === "check";
    const correctNow = submitted && choice === lesson.check.answer;
    const progressPct = Math.round(((step + (onCheck && submitted ? 1 : 0)) / steps.length) * 100);

    return (
      <div className={styles.lessonFull}>
        <div className={styles.lessonPlate}>
          <div className={`dark ${styles.lhead}`}>
            <svg className="contour skL" viewBox="0 0 900 200" preserveAspectRatio="none">
              <g stroke="currentColor" fill="none" strokeWidth="1.5" opacity="0.12">
                <path d="M-20 60C220 30 460 90 920 50" />
                <path d="M-20 110C220 80 460 140 920 100" />
                <path d="M-20 160C220 130 460 190 920 150" />
              </g>
            </svg>
            <span className={`pcirc ${styles.lheadPortrait}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset("/portraits/teach.png")} alt="Telos 老师" />
            </span>
            <div className={styles.lheadText}>
              <div className={styles.lm}>学习前沿 · 为你定制 · {domainLabel(node.domain)}</div>
              <h2>{node.name}</h2>
              <div className={styles.pills}>
                {steps.map((s, i) => (
                  <span key={s} className={`${styles.pill} ${i === step ? styles.pillOn : ""}`}>
                    {STEP_LABEL[s]}
                  </span>
                ))}
              </div>
            </div>
            <button className={styles.lessonClose} onClick={onClose} aria-label="关闭">
              ✕
            </button>
          </div>
          <div className={styles.lprogress}>
            <i style={{ width: `${progressPct}%` }} />
          </div>
          <div className={styles.lbody}>
            <div className={styles.lmain}>
              {stepKey === "explain" && (
                <>
                  <div className={styles.lstepLabel}>一句话讲清</div>
                  <p className={styles.lstepLead}>{lesson.explain}</p>
                  {lesson.analogy && (
                    <div className={styles.analogy}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <span className={`pmini ${styles.analogyPic}`}>
                        <img src={asset("/portraits/think.png")} alt="" />
                      </span>
                      <div>
                        <div className={styles.analogyL}>用你已会的来理解</div>
                        <p>{lesson.analogy}</p>
                      </div>
                    </div>
                  )}
                  <button className={`btn btn-ink ${styles.lessonBtn}`} onClick={() => setStep(step + 1)}>
                    继续 <Icon name="arrow" />
                  </button>
                </>
              )}

              {stepKey === "worked" && (
                <>
                  <div className={styles.lstepLabel}>跟着做一遍</div>
                  <p className={styles.workedProblem}>{lesson.worked.problem}</p>
                  <ol className={styles.workedSteps}>
                    {lesson.worked.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  <div className={styles.lessonActions}>
                    <button className={`btn btn-line ${styles.lessonBtn}`} onClick={() => setStep(step - 1)}>
                      上一步
                    </button>
                    <button className={`btn btn-ink ${styles.lessonBtn}`} onClick={() => setStep(step + 1)}>
                      去检验 <Icon name="arrow" />
                    </button>
                  </div>
                </>
              )}

              {stepKey === "check" && (
                <>
                  <div className={styles.lstepLabel}>检验一下 —— 答对就算掌握</div>
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
                  {!submitted ? (
                    <div className={styles.lessonActions}>
                      {steps.length > 1 && (
                        <button className={`btn btn-line ${styles.lessonBtn}`} onClick={() => setStep(step - 1)}>
                          上一步
                        </button>
                      )}
                      <button
                        className={`btn btn-ink ${styles.lessonBtn}`}
                        disabled={choice === null}
                        onClick={submitCheck}
                      >
                        提交答案
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className={correctNow ? styles.outcomeOk : styles.outcomeNo}>
                        {correctNow ? (
                          <>
                            <Icon name="check" style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 4 }} />
                            掌握了！
                          </>
                        ) : (
                          "还差一点。"
                        )}
                        {lesson.check.rationale && <span> {lesson.check.rationale}</span>}
                      </div>
                      {correctNow && pct > startPct && (
                        <div className={styles.lgain}>
                          <Icon name="up" style={{ width: 15, height: 15 }} />
                          <span>
                            掌握度 <b>{startPct}%</b> <span className={styles.lgainArrow}>→</span> <b>{pct}%</b>
                          </span>
                          {unlocks.length > 0 && pct >= 80 && (
                            <span className={styles.lgainArrow}>· 解锁 {unlocks.slice(0, 2).join("、")}</span>
                          )}
                        </div>
                      )}
                      <div className={styles.lessonActions}>
                        <button className={`btn btn-ink ${styles.lessonBtn}`} onClick={onClose}>
                          完成 <Icon name="arrow" />
                        </button>
                        {!correctNow && (
                          <button
                            className={`btn btn-line ${styles.lessonBtn}`}
                            onClick={() => {
                              setStep(0);
                              setSubmitted(false);
                              setChoice(null);
                            }}
                          >
                            再看一遍
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div className={styles.lside}>
              <div className={styles.lsideSec}>
                <h4>为什么学这个</h4>
                <div className={styles.lwhy}>
                  {unlocks.length ? (
                    <>
                      你的目标 <b>{goal}</b> 依赖它；学完会解锁 <b>{unlocks.slice(0, 3).join("、")}</b>
                      {unlocks.length > 3 ? " 等" : ""}。
                    </>
                  ) : (
                    "这是你这条路径的终点目标。"
                  )}
                </div>
              </div>
              <div className={styles.lsideSec}>
                <h4>当前掌握度</h4>
                <div className={styles.gauge}>
                  <div className={styles.gaugeG}>
                    <svg viewBox="0 0 64 64">
                      <circle className={styles.gaugeTk} cx="32" cy="32" r="26" />
                      <circle
                        className={styles.gaugeFg}
                        cx="32"
                        cy="32"
                        r="26"
                        strokeDasharray="163"
                        strokeDashoffset={163 * (1 - pct / 100)}
                      />
                    </svg>
                    <span className={styles.gaugeV}>{pct}%</span>
                  </div>
                  <div className={styles.lwhy}>{pct >= 80 ? "已掌握" : "答对检验题即标记掌握"}</div>
                </div>
              </div>
              {drill && (
                <div className={styles.lsideSec}>
                  <h4>怎么练</h4>
                  <div className={styles.lwhy}>{drill}</div>
                </div>
              )}
              {benchmark && (
                <div className={styles.lsideSec}>
                  <h4>达标线</h4>
                  <div className={styles.lwhy}>{benchmark}</div>
                </div>
              )}
              {lesson.resources && lesson.resources.length > 0 && (
                <div className={styles.lsideSec}>
                  <h4>优质公开课</h4>
                  <div className={styles.resRow}>
                    {lesson.resources.map((r, i) => (
                      <a
                        key={i}
                        className={styles.resLink}
                        href={resourceUrl(r.name, r.platform)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {r.name}
                        {r.platform ? ` · ${r.platform}` : ""} ↗
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════ 详情 / 加载 / 挑战 sheet ═══════
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

        {phase === "challenge" ? (
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
                        {chChoice === chProbe.answer ? (
                          <>
                            <Icon name="check" style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 4 }} />
                            已确认掌握
                          </>
                        ) : (
                          "看来还需要学一下。"
                        )}
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
              {node.isGoal && (
                <span className={styles.star}>
                  <Icon name="target" style={{ width: 16, height: 16 }} />
                </span>
              )}
              {node.name}
            </h3>
            <div className={styles.detailMeta}>
              <span className={`${styles.statusPill} ${styles[`pill_${status}`]}`}>{view.sub[pid]}</span>
              {status === "learn" && <span className={styles.metaDim}>掌握度 {pct}%</span>}
              <span className={styles.metaDim}>约 {node.minutes ?? 25} 分钟</span>
            </div>

            <p className={styles.detailDesc}>{desc}</p>

            {err && <div className={styles.drawerErr}>{err}</div>}

            {ready ? (
              <button
                className={`btn btn-ink ${styles.startBtn}`}
                onClick={start}
                disabled={phase === "loading" || !lessonReady}
              >
                {phase === "loading" ? "正在生成微课…" : status === "done" ? "再学一遍" : "开始学习"}{" "}
                {phase !== "loading" && <Icon name="arrow" />}
              </button>
            ) : (
              <div className={styles.lockNote}>
                <Icon name="lock" style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 5 }} />
                未解锁 · 先学完下面的前置
              </div>
            )}
            {!lessonReady && (
              <div className={styles.metaDim} style={{ marginTop: 8 }}>
                （微课需配置端点 —— 到「我 · 设置」里填本地 serve.py 或线上地址）
              </div>
            )}

            {status !== "done" && lessonReady && (
              <button className={styles.olmLink} onClick={challenge}>
                我其实已经会了，考我一下 →
              </button>
            )}

            {drill && (
              <div className={styles.detailSec}>
                <div className={styles.detailH}>怎么练</div>
                <div className={styles.unlockList}>{drill}</div>
              </div>
            )}

            {benchmark && (
              <div className={styles.detailSec}>
                <div className={styles.detailH}>达标线</div>
                <div className={styles.unlockList}>{benchmark}</div>
              </div>
            )}

            {prereqs.length > 0 && (
              <div className={styles.detailSec}>
                <div className={styles.detailH}>前置</div>
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
