"use client";

// 「坚持」Tab 主体（地图 · 复习 · 坚持 · 我）：多邻国式激励中心。
// 连胜横幅 + 今日目标进度环 + 断签保护 + 35 天打卡日历。全屏响应式：
// 手机单列堆叠 / 平板桌面左右分栏（今日+保护在左，日历占满右列）。
// 设计依据：Duolingo（目标自定、连胜按达成今日目标计、freeze 自动桥接、最多持 2）；
// 习惯类 App 日历热力网格；动机红线：XP 绑真实学习、目标可调可"轻松档"、防 over-justification。
import { useMemo } from "react";
import { Icon } from "@/components/icon";
import { SelectMenu, type MenuOption } from "@/components/select-menu";
import { useProject } from "@/lib/telos/use-project";
import { useT } from "@/lib/telos/i18n";
import { GOAL_OPTIONS, type DayCell } from "@/lib/telos/xp";

// 进度环：纯 SVG，描边随 pct 收放；达标显对勾，否则显百分比。
function Ring({ pct, met }: { pct: number; met: boolean }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return (
    <svg className="ring" viewBox="0 0 40 40" role="img" aria-label={`${Math.round(pct * 100)}%`}>
      <circle className="ring-trk" cx="20" cy="20" r={r} />
      <circle
        className={`ring-bar ${met ? "done" : ""}`}
        cx="20"
        cy="20"
        r={r}
        style={{ strokeDasharray: c, strokeDashoffset: off }}
        transform="rotate(-90 20 20)"
      />
      {met ? (
        <path className="ring-chk" d="M13 20.5l4.5 4.5L28 14" />
      ) : (
        <text x="20" y="20" textAnchor="middle" dominantBaseline="central" className="ring-pct">
          {Math.round(pct * 100)}%
        </text>
      )}
    </svg>
  );
}

export function StreakBoard() {
  const { t, lang } = useT();
  const { streak, dailyXp, dailyGoal, dailyPct, dailyGoalMet, freezes, calendar, setDailyGoal } = useProject();

  // 本地化星期表头（周一起头，narrow 单字）+ 日期标题，全用 Intl，免手填 9 语。
  const weekHead = useMemo(() => {
    try {
      const f = new Intl.DateTimeFormat(lang, { weekday: "narrow" });
      return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i))); // 2024-01-01 是周一
    } catch {
      return ["一", "二", "三", "四", "五", "六", "日"];
    }
  }, [lang]);

  const dateFmt = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(lang, { month: "short", day: "numeric" });
    } catch {
      return null;
    }
  }, [lang]);
  const titleOf = (cell: DayCell) => {
    const [y, m, d] = cell.date.split("-").map(Number);
    const ds = dateFmt ? dateFmt.format(new Date(y, m - 1, d)) : cell.date;
    const tail = cell.frozen ? ` · ${t("daily.frozen")}` : cell.xp > 0 ? ` · ${cell.xp} XP` : "";
    return `${ds}${tail}`;
  };

  // 周一起头：把 weekday(0=日..6=六) 映射到列(0=周一..6=周日)。首格补空。
  const col = (weekday: number) => (weekday + 6) % 7;
  const lead = calendar.length ? col(calendar[0].weekday) : 0;

  const goalOpts: MenuOption[] = GOAL_OPTIONS.map((g) => ({ value: String(g), label: t(`daily.tier${g}`) }));
  const remain = Math.max(0, dailyGoal - dailyXp);

  return (
    <div className="streak">
      <header className="streak-hd">
        <div className="eyebrow">{t("streak.eyebrow")}</div>
        <h2>{t("nav.streak")}</h2>
        <p className="streak-lead">{t("streak.lead")}</p>
      </header>

      {/* 连胜横幅 */}
      <div className="streak-banner">
        <Icon name="flame" className={`sb-fl ${streak > 0 ? "on" : ""}`} />
        <div className="sb-num">
          <b>{streak}</b>
          <span>{t("daily.dayUnit")}</span>
        </div>
        <span className="sb-div" aria-hidden="true" />
        <div className="sb-state">
          {dailyGoalMet ? (
            <>
              <Icon name="check" /> {t("daily.metToday")}
            </>
          ) : (
            t("daily.remainXp", { n: remain })
          )}
        </div>
      </div>

      <div className="streak-grid">
        <div className="streak-col">
          {/* 今日目标 */}
          <section className="streak-card">
            <div className="sc-h">
              <h3>{t("daily.title")}</h3>
              <SelectMenu
                className="daily-goalsel"
                buttonClassName="daily-goalsel-btn"
                ariaLabel={t("daily.setGoal")}
                align="end"
                value={String(dailyGoal)}
                options={goalOpts}
                onChange={(v) => setDailyGoal(Number(v))}
                trigger={(cur, open) => (
                  <>
                    <Icon name="target" />
                    <span>{cur.label}</span>
                    <Icon name="chevron" className={`cv ${open ? "up" : ""}`} />
                  </>
                )}
              />
            </div>
            <div className="today-body">
              <Ring pct={dailyPct} met={dailyGoalMet} />
              <div className="daily-meta">
                <div className="lab">{t("daily.todayGoal")}</div>
                <div className="val">
                  <b>{dailyXp}</b>
                  <span className="den"> / {dailyGoal} XP</span>
                </div>
                <div className={`state ${dailyGoalMet ? "ok" : ""}`}>
                  {dailyGoalMet ? (
                    <>
                      <Icon name="check" /> {t("daily.metToday")}
                    </>
                  ) : (
                    t("daily.remainXp", { n: remain })
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 断签保护 */}
          <section className="streak-card">
            <div className="daily-freeze">
              <span className="fz-ic">
                <Icon name="shield" className={freezes > 0 ? "on" : ""} />
              </span>
              <div className="fz-txt">
                <b>{t("daily.freezeN", { n: freezes })}</b>
                <span>{freezes > 0 ? t("daily.freezeOn") : t("daily.freezeOff")}</span>
              </div>
            </div>
          </section>
        </div>

        {/* 打卡日历 */}
        <section className="streak-card cal-card">
          <div className="sc-h">
            <h3>{t("streak.calTitle")}</h3>
          </div>
          <div className="daily-cal">
            <div className="cal-head">
              {weekHead.map((w, i) => (
                <span key={i} className="cal-wd">
                  {w}
                </span>
              ))}
            </div>
            <div className="cal-grid">
              {Array.from({ length: lead }, (_, i) => (
                <span key={`b${i}`} className="cal-cell blank" aria-hidden="true" />
              ))}
              {calendar.map((cell) => (
                <span
                  key={cell.date}
                  className={`cal-cell ${cell.met ? "met" : cell.partial ? "partial" : "miss"} ${cell.frozen ? "frozen" : ""} ${cell.today ? "today" : ""}`.trim()}
                  title={titleOf(cell)}
                >
                  {cell.frozen && <Icon name="shield" />}
                </span>
              ))}
            </div>
            <div className="cal-legend">
              <span>
                <i className="sw met" /> {t("daily.legendMet")}
              </span>
              <span>
                <i className="sw partial" /> {t("daily.legendPartial")}
              </span>
              <span>
                <i className="sw frozen">
                  <Icon name="shield" />
                </i>{" "}
                {t("daily.legendFrozen")}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
