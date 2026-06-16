"use client";

// 入口 = 真实产品。默认打开 = 「新学习」目标引导（ChatGPT 式，composing 初始 true）；
// 点「地图」Tab / 切换项目 / 倒推完成 → 地图主页。节点 → 详情 sheet → 开始学习（分步微课全屏接管）。
// 所有数据来自 useProject 单一真相源。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import NodePanel from "@/components/node-panel";
import PathView from "@/components/path-view";
// 画布静态导入（核心界面）：之前用 dynamic 懒加载，部署更替后旧 HTML 缓存(GitHub Pages ≤10min)
// 引用的旧 chunk 已 404 → 地图永远停在「加载地图…」，需再刷新才好。静态导入后页面 JS 能起，地图必能起。
import DeriveCanvas from "@/components/canvas";
import { useProject } from "@/lib/telos/use-project";
import { useCurrentPortraitFile } from "@/lib/telos/portraits";
import { moodFace, type Mood } from "@/lib/telos/mood";
import { useAuth } from "@/lib/telos/auth";
import { cloudConfigured } from "@/lib/telos/supabase";
import { domainLabel } from "@/lib/telos/engine";
import { engineReady, LLM_EVENT, type DeriveProgress } from "@/lib/telos/derive";
import { BILLING_EVENT, isPro } from "@/lib/telos/billing";
import { BILLING } from "@/lib/telos/billing-config";
import { useT } from "@/lib/telos/i18n";

// 六类学习（domain A-F）+ 各一个代表性示例目标（i18n key）。点卡片填入输入框，覆盖 Telos 支持的全部学习机制。
const CATS: { domain: string; egKey: string }[] = [
  { domain: "A", egKey: "ob.catMemory" },
  { domain: "B", egKey: "ob.eg1" },
  { domain: "C", egKey: "ob.catCreate" },
  { domain: "D", egKey: "ob.eg5" },
  { domain: "E", egKey: "ob.catCompete" },
  { domain: "F", egKey: "ob.catHabit" },
];


export default function HubPage() {
  const {
    ready,
    project,
    graph,
    view,
    derive,
    deriving,
    deriveError,
    deriveProgress,
    record,
    composing,
    projects,
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
        <Onboarding derive={derive} deriving={deriving} deriveError={deriveError} progress={deriveProgress} projectCount={projects.length} />
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

// 倒推真实进度 → 进度段（floor/ceil/tau/文案）。里程碑给 floor，floor→ceil 间按本段用时缓爬，
// 绝不越过下一个真实里程碑（诚实）；各段 ceil=下段 floor，全程单调不回退。
function progressSeg(p: DeriveProgress | null): { floor: number; ceil: number; tau: number; key: string } {
  switch (p?.phase) {
    case "search":
      return { floor: 6, ceil: 18, tau: 6, key: "ob.phUnderstand" };
    case "blueprint":
      return { floor: 18, ceil: 24, tau: 12, key: "ob.phBlueprint" };
    case "expand": {
      const t = p.modulesTotal || 0;
      const d = p.modulesDone || 0;
      const lo = 24;
      const hi = 84;
      const f = t > 0 ? lo + (hi - lo) * (d / t) : lo;
      const c = t > 0 ? lo + (hi - lo) * ((d + 1) / t) : hi;
      return { floor: f, ceil: Math.min(hi, c), tau: 7, key: "ob.phExpand" };
    }
    case "assemble":
      return { floor: 84, ceil: 90, tau: 2, key: "ob.phAssemble" };
    case "single":
      return { floor: 30, ceil: 82, tau: 40, key: "ob.phExpand" };
    case "critique":
      return { floor: 90, ceil: 99, tau: 16, key: "ob.phCritique" };
    default:
      return { floor: 0, ceil: 8, tau: 6, key: "ob.phUnderstand" }; // 还没收到事件
  }
}

// ─────────────────────────── 引导 / 目标输入 ───────────────────────────
function Onboarding({
  derive,
  deriving,
  deriveError,
  progress,
  projectCount,
}: {
  derive: (g: string) => Promise<boolean>;
  deriving: boolean;
  deriveError: string | null;
  progress: DeriveProgress | null;
  projectCount: number;
}) {
  const { t } = useT();
  const { user } = useAuth();
  const [goal, setGoal] = useState("");
  const [mounted, setMounted] = useState(false);
  const [cfgUrl, setCfgUrl] = useState("");
  const [pro, setPro] = useState(false);
  const [ms, setMs] = useState(0); // 倒推已用毫秒——驱动进度条 + 实时秒数
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const manualFace = useCurrentPortraitFile(); // 形象集里手动选的陪伴形象
  // 情境神态：无项目→迎新；有项目→用手动选的（她还会随场景说话——"活的"陪伴，不只一张死图）
  const heroMood: Mood = projectCount > 0 ? "idle" : "welcome";
  const returning = projectCount > 0; // 回头客（已有项目）→ 压缩头、直奔输入；新人 → 完整 hero 讲清楚
  const heroFace = moodFace(heroMood)?.file ?? manualFace;
  const heroBubbleKey = heroMood === "welcome" ? "mood.welcome" : "mood.idle";
  // 免费版项目数上限：超限时在输入框下方给事前提示（derive 内还有硬校验兜底）
  const limitReached = mounted && !pro && projectCount >= BILLING.freeProjectLimit;

  useEffect(() => {
    setMounted(true);
    const sync = () => setCfgUrl(engineReady() ? "ready" : "");
    sync();
    const syncPro = () => setPro(isPro());
    syncPro();
    window.addEventListener(LLM_EVENT, sync); // 配好 key/端点后即时收起「需配置」提示
    window.addEventListener(BILLING_EVENT, syncPro);
    return () => {
      window.removeEventListener(LLM_EVENT, sync);
      window.removeEventListener(BILLING_EVENT, syncPro);
    };
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
  // 真实进度：按 deriveProgress 的里程碑算 floor/ceil，本段内按用时缓爬（绝不越过下一个真实里程碑）。
  const seg = progressSeg(progress);
  const segSig = `${progress?.phase ?? "wait"}:${progress?.modulesDone ?? 0}`;
  const segStartRef = useRef(0);
  const segSigRef = useRef("");
  useEffect(() => {
    segSigRef.current = segSig;
    segStartRef.current = ms;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segSig]);
  const segDt = segSigRef.current === segSig ? Math.max(0, ms - segStartRef.current) : 0;
  const progPct = Math.round(seg.floor + (seg.ceil - seg.floor) * (1 - Math.exp(-segDt / (seg.tau * 1000))));
  const phaseKey = seg.key;

  return (
    <div className={returning ? "ob ob-compact" : "ob"}>
      <div className="ob-hero">
        <div className="ob-hero-main">
          {!returning && <div className="eyebrow">{t("ob.eyebrow")}</div>}
          <h1>
            {t("ob.h1line1")}
            <br />
            {t("ob.h1line2")}
          </h1>
          {!returning && <p className="ob-lead">{t("ob.lead")}</p>}

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
                disabled={deriving || !goal.trim() || limitReached}
              >
                {deriving ? t("ob.deriving") : t("ob.derive")} {!deriving && <Icon name="arrow" />}
              </button>
            </div>
          </div>

          {limitReached && (
            <div className="ob-limit" role="note">
              <Icon name="spark" style={{ width: 16, height: 16 }} />
              <span className="lt">
                <b>{t("pro.limitT", { n: BILLING.freeProjectLimit })}</b>
                <span>
                  {t("pro.limitD")} <Link href="/pro">{t("pro.limitGo")} →</Link>
                </span>
              </span>
            </div>
          )}

          {deriving && (
            <div className="ob-prog" role="status" aria-live="polite">
              <div className="ob-prog-bar">
                <i style={{ width: `${progPct}%` }} />
              </div>
              <div className="ob-prog-row">
                <span className="ob-prog-phase">
                  {t(phaseKey)}
                  {progress?.phase === "expand" && progress.modulesTotal ? (
                    <span className="ob-prog-mods">
                      {t("ob.modules", { done: progress.modulesDone ?? 0, total: progress.modulesTotal })}
                    </span>
                  ) : null}
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
          <div className="ob-bubble" role="status">{t(heroBubbleKey)}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="pcirc">
            <img src={asset(`/portraits/${heroFace}.webp`)} alt="Telos 老师" />
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

      {/* 官方模板店入口：现成的精修图谱，一键导入（知识付费） */}
      <Link href="/store" className="ob-store">
        <span className="os-ic">
          <Icon name="map" style={{ width: 17, height: 17 }} />
        </span>
        <span className="os-t">
          <b>{t("ob.storeTitle")}</b>
          <span>{t("ob.storeDesc")}</span>
        </span>
        <Icon name="chevron" className="os-go" style={{ width: 15, height: 15, transform: "rotate(-90deg)" }} />
      </Link>

      {mounted && !cfgUrl && (
        <div className="ob-cfgrow">
          {cloudConfigured() && !user && (
            // 引擎未就绪且未登录：主推「登录免费试用」（托管 AI，无需配 key——商业化主入口）
            <Link href="/account" className="ob-cfglink ob-cfglink-primary">
              <Icon name="spark" style={{ width: 12, height: 12 }} /> {t("ob.tryHosted")}
              <Icon name="arrow" style={{ width: 12, height: 12 }} />
            </Link>
          )}
          <Link href="/settings" className="ob-cfglink">
            <span className="dot dot-off" /> {t("ob.cfgNeed")}
            <Icon name="arrow" style={{ width: 12, height: 12 }} />
          </Link>
        </div>
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
  const { project, graph, view } = useProject();
  const { t } = useT();
  const [isPhone, setIsPhone] = useState(false);
  // 阶段概览：点击行 → 往下内联展开该阶段的能力点清单（手风琴），不再直接弹节点详情
  const [openMod, setOpenMod] = useState<string | null>(null);
  // 视图默认：**电脑优先地图、手机优先路径**。偏好按【设备类】分别记忆（telos:mapview:d / :m），
  // 各自记住各自的选择、互不串味——在桌面切到路径不会让手机也变路径，反之亦然。
  const [phoneView, setPhoneView] = useState<"path" | "map">("map");
  const viewKey = (phone: boolean) => (phone ? "telos:mapview:m" : "telos:mapview:d");
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const resolve = () => {
      const phone = mq.matches;
      setIsPhone(phone);
      const saved = localStorage.getItem(viewKey(phone));
      setPhoneView(saved === "map" || saved === "path" ? saved : phone ? "path" : "map");
    };
    resolve();
    mq.addEventListener("change", resolve);
    return () => mq.removeEventListener("change", resolve);
  }, []);
  const pickView = (v: "path" | "map") => {
    setPhoneView(v);
    try {
      localStorage.setItem(viewKey(window.matchMedia("(max-width: 640px)").matches), v);
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
        {(
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
        {phoneView === "path" ? (
          <PathView graph={graph} view={view} onOpenNode={onOpenNode} />
        ) : (
          <DeriveCanvas graph={graph} view={view} onOpenNode={onOpenNode} title={project.title || project.goal} />
        )}
      </div>

      <aside className="mh-rail">
        {/* 看板娘意义锚定：进步可见(Agent3)。仅有进度时显示——fresh 用下方 recap 锚定初心，不重复 */}
        {!fresh && (
          <div className="mh-companion">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="pmini">
              <img src={asset("/portraits/point.webp")} alt="" />
            </span>
            <p>{t("home.coProgress", { goal: project.goal, n: view.mastered, total: view.total })}</p>
          </div>
        )}
        {fresh && next && (
          <div className="mh-recap">
            {t("home.recap", {
              goal: project.goal,
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
            {/* 进度并入 CTA（唯一进度展示）：细条 + 已掌握 N/总 + 预计天数，替代原先独立的白色进度卡，去重 + 去「突兀白条」 */}
            <div className="mh-cta-prog">
              <div className="mh-cta-track">
                <i style={{ width: `${view.pct}%` }} />
              </div>
              <div className="mh-cta-pmeta">
                <span>
                  <b>{view.mastered}</b>/{view.total} {t("word.mastered")}
                </span>
                <span>{view.goalsReached ? t("home.etaReached") : t("home.eta", { days: view.etaDays })}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="dark mh-cta">
            <div className="l">{t("home.goalReachedL")}</div>
            <div className="t">{t("home.goalReachedT")}</div>
            <div className="d">{t("home.goalReachedD")}</div>
          </div>
        )}

        {view.modules.length > 1 && (
          <div className="mh-card mh-card-paper">
            <h4>
              {t("home.modulesTitle")}
              <span className="mh-n">{t("home.modulesCount", { n: view.modules.length })}</span>
            </h4>
            <div className="mh-mods">
              {view.modules.map((m, i) => {
                const mp = m.total ? Math.round((m.mastered / m.total) * 100) : 0;
                const open = openMod === m.id;
                const nodes = graph.ids().filter((id) => (graph.get(id).module || "") === m.id);
                return (
                  <div key={m.id} className={`mh-mod-wrap ${open ? "open" : ""}`}>
                    <button
                      className="mh-mod"
                      onClick={() => setOpenMod(open ? null : m.id)}
                      aria-expanded={open}
                      title={m.title}
                    >
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
                      <Icon name="chevron" className={`mh-mod-cv ${open ? "up" : ""}`} style={{ width: 14, height: 14 }} />
                    </button>
                    <div className={`mh-mod-panel ${open ? "open" : ""}`}>
                      <div className="mh-mod-panel-in">
                        {nodes.map((id) => (
                          <button
                            key={id}
                            className="mh-skrow"
                            onClick={() => onOpenNode(id)}
                            title={`${graph.get(id).name} · ${view.sub[id]}`}
                          >
                            <span className={`mh-skdot st-${view.visual[id]}`} />
                            <span className="mh-skname">{graph.get(id).name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view.due.length > 0 && (
          <div className="mh-card">
            <h4>
              {t("home.dueTitle")}
              <span className="mh-n">{t("home.dueCount", { n: view.due.length })}</span>
            </h4>
            {view.due.slice(0, 4).map((d) => (
              <button key={d.id} className="mh-due-row" onClick={() => onOpenNode(d.id)}>
                <Icon name="refresh" />
                <b>{d.name}</b>
                <span className="t">{t("home.dueReview")}</span>
              </button>
            ))}
          </div>
        )}

        <button className="mh-relink" onClick={onDiagnose}>
          <Icon name="spark" style={{ width: 13, height: 13 }} /> {fresh ? t("home.diagnoseFirst") : t("home.diagnoseAgain")}
        </button>
      </aside>
    </div>
  );
}
