"use client";

// 交互式微课运行器（#9）：把"讲解→跟着做→校验"换成一条分步状态机——
// 预测先行 → 直觉讲解 → 分步范例(逐步揭示) → 自我解释 → 渐隐填空(完成式问题) → 无脚手架检索(掌握闸门)。
// 答错走【提示阶梯】：逐条加深提示、用尽才揭示答案，绝不一上来就给答案(Khanmigo/刻意失败/检索练习)。
import { useMemo, useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import styles from "./app.module.css";
import type { Lesson, LessonResource, LessonStep } from "@/lib/telos/derive";
import { useT } from "@/lib/telos/i18n";

// 降级（无真实 url）时按平台拼一个搜索链接，仍是真实可点的页面、不编造具体视频地址。
function resourceUrl(name: string, platform: string): string {
  const q = encodeURIComponent(name);
  const p = (platform || "").toLowerCase();
  if (p.includes("youtube")) return `https://www.youtube.com/results?search_query=${q}`;
  if (p.includes("bili") || p.includes("b站") || p.includes("哔哩")) return `https://search.bilibili.com/all?keyword=${q}`;
  if (p.includes("coursera")) return `https://www.coursera.org/search?query=${q}`;
  if (p.includes("mooc") || p.includes("中国大学")) return `https://www.icourse163.org/search.htm?search=${q}`;
  return `https://www.bing.com/search?q=${q}`;
}

function domainOf(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch {
    return "";
  }
}

// 降级态把平台名映射到真实域名，让 favicon 仍可显示（grounded 态直接用真实 domain）。
function platformDomain(platform: string): string {
  const p = (platform || "").toLowerCase();
  if (p.includes("youtube")) return "youtube.com";
  if (p.includes("bili") || p.includes("b站") || p.includes("哔哩")) return "bilibili.com";
  if (p.includes("coursera")) return "coursera.org";
  if (p.includes("mooc") || p.includes("中国大学") || p.includes("icourse")) return "icourse163.org";
  if (p.includes("khan")) return "khanacademy.org";
  if (p.includes("react")) return "react.dev";
  if (p.includes("mdn")) return "developer.mozilla.org";
  if (/[a-z0-9-]+\.[a-z]{2,}/.test(p)) return p; // 本身就是个域名
  return "";
}

// 引用卡片：真实来源(联网检索)→favicon + 标题 + 域名，直达；降级→平台搜索链接，标注「搜索」。
function ResourceCard({ r }: { r: LessonResource }) {
  const { t } = useT();
  const [favOk, setFavOk] = useState(true);
  const real = !!r.url;
  const href = r.url || resourceUrl(r.name, r.platform || "");
  const domain = r.domain || (r.url ? domainOf(r.url) : "");
  const favDomain = domain || platformDomain(r.platform || "");
  const meta = (domain || r.platform || t("res.source")) + (real ? "" : ` · ${t("res.search")}`);
  return (
    <a className={styles.resCard} href={href} target="_blank" rel="noopener noreferrer" title={r.snippet || r.name}>
      {favDomain && favOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.resFav}
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(favDomain)}&sz=64`}
          alt=""
          loading="lazy"
          onError={() => setFavOk(false)}
        />
      ) : (
        <span className={`${styles.resFav} ${styles.resFavDot}`} aria-hidden>
          {(domain || r.platform || "?").slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className={styles.resCardBody}>
        <span className={styles.resCardName}>{r.name}</span>
        <span className={styles.resCardMeta}>{meta}</span>
      </span>
      <span className={styles.resGo} aria-hidden>
        ↗
      </span>
    </a>
  );
}

interface Nav {
  last: boolean;
  onAdvance: () => void;
  onFinish: () => void;
}

export default function LessonRunner({
  lesson,
  nodeName,
  domainText,
  unlocks,
  goal,
  masteryPct,
  startPct,
  drill,
  benchmark,
  onGrade,
  onClose,
}: {
  lesson: Lesson;
  nodeName: string;
  domainText: string;
  unlocks: string[];
  goal: string;
  masteryPct: number;
  startPct: number;
  drill?: string;
  benchmark?: string;
  onGrade: (correct: boolean) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const steps = lesson.steps;
  const [idx, setIdx] = useState(0);
  const [graded, setGraded] = useState(false);

  // 掌握闸门：优先最后一个 retrieve，其次 faded，再次 self_explain，兜底末步。
  const gateIdx = useMemo(() => {
    const lastOf = (k: string) => {
      let g = -1;
      steps.forEach((s, i) => {
        if (s.kind === k) g = i;
      });
      return g;
    };
    for (const k of ["retrieve", "faded", "self_explain"]) {
      const i = lastOf(k);
      if (i >= 0) return i;
    }
    return steps.length - 1;
  }, [steps]);

  const step = steps[idx];
  const last = idx >= steps.length - 1;
  const nav: Nav = {
    last,
    onAdvance: () => setIdx((i) => Math.min(i + 1, steps.length - 1)),
    onFinish: onClose,
  };
  const progress = Math.round(((idx + 1) / steps.length) * 100);
  const resolveGate = (correct: boolean) => {
    if (idx === gateIdx && !graded) {
      setGraded(true);
      onGrade(correct);
    }
  };

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
            <div className={styles.lm}>{t("lr.headEyebrow", { domain: domainText })}</div>
            <h2>{nodeName}</h2>
            <div className={styles.pills}>
              {steps.map((s, i) => (
                <span key={i} className={`${styles.pill} ${i === idx ? styles.pillOn : ""}`}>
                  {t("kind." + s.kind)}
                </span>
              ))}
            </div>
          </div>
          <button className={styles.lessonClose} onClick={onClose} aria-label={t("common.close")}>
            ✕
          </button>
        </div>
        <div className={styles.lprogress}>
          <i style={{ width: `${progress}%` }} />
        </div>

        <div className={styles.lbody}>
          <div className={styles.lmain}>
            {idx === 0 && lesson.concept && (
              <div className={styles.lconcept}>
                <Icon name="spark" style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 5 }} />
                {lesson.concept}
              </div>
            )}
            <StepBody
              key={idx}
              step={step}
              nav={nav}
              isGate={idx === gateIdx}
              onResolveGate={resolveGate}
              gain={{ startPct, masteryPct, unlocks }}
            />
          </div>

          <div className={styles.lside}>
            <div className={styles.lsideSec}>
              <h4>{t("lr.whyTitle")}</h4>
              <div className={styles.lwhy}>
                {unlocks.length
                  ? t("lr.why", {
                      goal,
                      unlocks: unlocks.slice(0, 3).join(", "),
                      more: unlocks.length > 3 ? t("np.listMore") : "",
                    })
                  : t("lr.whyEnd")}
              </div>
            </div>
            <div className={styles.lsideSec}>
              <h4>{t("lr.masteryTitle")}</h4>
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
                      strokeDashoffset={163 * (1 - masteryPct / 100)}
                    />
                  </svg>
                  <span className={styles.gaugeV}>{masteryPct}%</span>
                </div>
                <div className={styles.lwhy}>{masteryPct >= 80 ? t("word.mastered") : t("lr.gateHint")}</div>
              </div>
            </div>
            {drill && (
              <div className={styles.lsideSec}>
                <h4>{t("np.howToPractice")}</h4>
                <div className={styles.lwhy}>{drill}</div>
              </div>
            )}
            {benchmark && (
              <div className={styles.lsideSec}>
                <h4>{t("np.benchmark")}</h4>
                <div className={styles.lwhy}>{benchmark}</div>
              </div>
            )}
            {lesson.resources && lesson.resources.length > 0 && (
              <div className={styles.lsideSec}>
                <h4>{t("lr.resources")}</h4>
                <div className={styles.resCards}>
                  {lesson.resources.map((r, i) => (
                    <ResourceCard key={r.url || r.name + i} r={r} />
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

function ContinueBtn({ nav }: { nav: Nav }) {
  const { t } = useT();
  return (
    <button className={`btn btn-ink ${styles.lessonBtn}`} onClick={nav.last ? nav.onFinish : nav.onAdvance}>
      {nav.last ? t("lr.finish") : t("lr.continue")} <Icon name="arrow" />
    </button>
  );
}

function StepBody({
  step,
  nav,
  isGate,
  onResolveGate,
  gain,
}: {
  step: LessonStep;
  nav: Nav;
  isGate: boolean;
  onResolveGate: (correct: boolean) => void;
  gain: { startPct: number; masteryPct: number; unlocks: string[] };
}) {
  const { t } = useT();
  if (step.kind === "explain") {
    return (
      <>
        <div className={styles.lstepLabel}>{t("lr.explainLabel")}</div>
        <p className={styles.lstepLead}>{step.text}</p>
        {step.analogy && (
          <div className={styles.analogy}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className={`pmini ${styles.analogyPic}`}>
              <img src={asset("/portraits/think.png")} alt="" />
            </span>
            <div>
              <div className={styles.analogyL}>{t("lr.analogyLabel")}</div>
              <p>{step.analogy}</p>
            </div>
          </div>
        )}
        <div className={styles.lessonActions}>
          <ContinueBtn nav={nav} />
        </div>
      </>
    );
  }
  if (step.kind === "worked") {
    return <WorkedStep step={step} nav={nav} />;
  }
  return <McqStep step={step} nav={nav} isGate={isGate} onResolveGate={onResolveGate} gain={gain} />;
}

function WorkedStep({ step, nav }: { step: Extract<LessonStep, { kind: "worked" }>; nav: Nav }) {
  const { t } = useT();
  const [shown, setShown] = useState(1); // 已揭示步数（分步揭示，降低认知负荷）
  const all = shown >= step.steps.length;
  return (
    <>
      <div className={styles.lstepLabel}>{t("lr.workedLabel")}</div>
      {step.problem && <p className={styles.workedProblem}>{step.problem}</p>}
      <ol className={styles.workedSteps}>
        {step.steps.slice(0, shown).map((s, i) => (
          <li key={i}>
            <b>{s.do}</b>
            {s.why ? <span className={styles.workedWhy}> —— {s.why}</span> : null}
          </li>
        ))}
      </ol>
      <div className={styles.lessonActions}>
        {!all ? (
          <button className={`btn btn-ink ${styles.lessonBtn}`} onClick={() => setShown((n) => n + 1)}>
            {t("lr.nextStep")} <Icon name="arrow" />
          </button>
        ) : (
          <ContinueBtn nav={nav} />
        )}
      </div>
    </>
  );
}

function McqStep({
  step,
  nav,
  isGate,
  onResolveGate,
  gain,
}: {
  step: Extract<LessonStep, { kind: "predict" | "self_explain" | "faded" | "retrieve" }>;
  nav: Nav;
  isGate: boolean;
  onResolveGate: (correct: boolean) => void;
  gain: { startPct: number; masteryPct: number; unlocks: string[] };
}) {
  const { t } = useT();
  const isPredict = step.kind === "predict";
  const hints = ("hints" in step && step.hints) || [];
  const rationale = "rationale" in step ? step.rationale : "";
  const reveal = "reveal" in step ? step.reveal : "";
  const given = step.kind === "faded" ? step.given ?? [] : [];
  const problem = step.kind === "faded" ? step.problem : "";

  const [choice, setChoice] = useState<number | null>(null);
  const [wrongs, setWrongs] = useState(0);
  const [resolved, setResolved] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const correct = resolved && choice === step.answer;
  const hintsShown = Math.min(wrongs, hints.length);

  function submit() {
    if (choice === null || resolved) return;
    if (isPredict) {
      setResolved(true); // 预测不计分：提交即揭示
      return;
    }
    if (choice === step.answer) {
      setResolved(true);
      if (isGate) onResolveGate(true);
    } else {
      const w = wrongs + 1;
      setWrongs(w);
      if (w > hints.length) {
        // 提示阶梯用尽仍错 → 揭示正确答案（给台阶下，不卡死）
        setRevealed(true);
        setResolved(true);
        if (isGate) onResolveGate(false);
      } else {
        setChoice(null); // 还有提示：清空选择，看提示再试
      }
    }
  }

  const showHighlight = resolved && (correct || revealed || isPredict);

  const label =
    step.kind === "self_explain"
      ? t("lr.labelSelfExplain")
      : step.kind === "faded"
        ? t("lr.labelFaded")
        : step.kind === "retrieve"
          ? t("lr.labelRetrieve")
          : t("lr.labelPredict");

  return (
    <>
      <div className={styles.lstepLabel}>{label}</div>
      {problem && <p className={styles.workedProblem}>{problem}</p>}
      {given.length > 0 && (
        <div className={styles.lgiven}>
          {given.map((g, i) => (
            <div key={i} className={styles.lgivenItem}>
              <Icon name="check" style={{ width: 12, height: 12, verticalAlign: -2, marginRight: 6 }} />
              {g}
            </div>
          ))}
        </div>
      )}
      <p className={styles.checkQ}>{step.prompt}</p>
      <div className={styles.opts}>
        {step.options.map((o, i) => {
          const isAns = i === step.answer;
          const cls = [
            styles.opt,
            showHighlight && isAns ? styles.optRight : "",
            showHighlight && choice === i && !isAns ? styles.optWrong : "",
            !resolved && choice === i ? styles.optSel : "",
          ].join(" ");
          return (
            <button key={i} className={cls} disabled={resolved} onClick={() => setChoice(i)}>
              <span className={styles.optMark}>{String.fromCharCode(65 + i)}</span>
              {o}
            </button>
          );
        })}
      </div>

      {/* 提示阶梯 */}
      {hintsShown > 0 && !revealed && !correct && (
        <div className={styles.lhints}>
          {hints.slice(0, hintsShown).map((h, i) => (
            <div key={i} className={styles.lhint}>
              <b>{t("lr.hintN", { n: i + 1 })}</b> {h}
            </div>
          ))}
        </div>
      )}

      {!resolved ? (
        <div className={styles.lessonActions}>
          <button
            className={`btn btn-ink ${styles.lessonBtn}`}
            disabled={choice === null}
            onClick={submit}
          >
            {wrongs > 0 ? t("lr.submitRetry") : isPredict ? t("lr.submitGuess") : t("np.submit")}
          </button>
        </div>
      ) : (
        <>
          {isPredict ? (
            <div className={styles.outcomeNo}>
              {t("lr.predictAnswer", { letter: String.fromCharCode(65 + step.answer), reveal: reveal ?? "" })}
            </div>
          ) : (
            <div className={correct ? styles.outcomeOk : styles.outcomeNo}>
              {correct ? (
                <>
                  <Icon name="check" style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 4 }} />
                  {t("lr.correct")}
                </>
              ) : (
                t("lr.seeAnswer")
              )}
              {rationale && <span> {rationale}</span>}
            </div>
          )}
          {isGate && correct && gain.masteryPct > gain.startPct && (
            <div className={styles.lgain}>
              <Icon name="up" style={{ width: 15, height: 15 }} />
              <span>
                <b>{gain.startPct}%</b> <span className={styles.lgainArrow}>→</span> <b>{gain.masteryPct}%</b>
              </span>
              {gain.unlocks.length > 0 && gain.masteryPct >= 80 && (
                <span className={styles.lgainArrow}>{t("lr.gainUnlock", { list: gain.unlocks.slice(0, 2).join(", ") })}</span>
              )}
            </div>
          )}
          <div className={styles.lessonActions}>
            <ContinueBtn nav={nav} />
          </div>
        </>
      )}
    </>
  );
}
