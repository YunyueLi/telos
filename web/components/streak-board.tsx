"use client";

// 「坚持」Tab 主体（地图 · 复习 · 坚持 · 我）：多邻国式激励中心。
// 连胜横幅 + 今日目标进度环 + 断签保护 + 月历打卡（可翻看历史月，格子标真实日期）。
// 全屏响应式：手机单列堆叠 / 平板桌面左右分栏（今日+保护在左，日历占满右列）。
// 设计依据：Duolingo（目标自定、连胜按达成今日目标计、freeze 自动桥接、最多持 2）；
// 习惯类 App 月历打卡（月份切换、日期数字、今日高亮、未来日淡显）；动机红线见 xp.ts。
import { useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { SelectMenu, type MenuOption } from "@/components/select-menu";
import { useProject } from "@/lib/telos/use-project";
import { useT } from "@/lib/telos/i18n";
import {
  GOAL_OPTIONS,
  TIER_MIN_LEVEL,
  bestDayXp,
  levelInfo,
  maxStreak,
  monthGrid,
  totalXp,
  type DayCell,
} from "@/lib/telos/xp";

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
  const { streak, dailyXp, dailyGoal, dailyPct, dailyGoalMet, freezes, dailyVersion, setDailyGoal, view } =
    useProject();

  // 等级 / 段位 / 个人纪录（全本地真实算，随学习重算）。
  const total = useMemo(() => totalXp(), [dailyVersion]);
  const lvl = useMemo(() => levelInfo(total), [total]);
  const longest = useMemo(() => maxStreak(), [dailyVersion]);
  const best = useMemo(() => bestDayXp(), [dailyVersion]);
  const mastered = view?.mastered ?? 0;
  const mapPct = view?.pct ?? 0;
  const achievements: { id: string; icon: IconName; value: number; target: number }[] = [
    { id: "firstStep", icon: "check", value: Math.min(longest, 1), target: 1 },
    { id: "streak7", icon: "flame", value: longest, target: 7 },
    { id: "streak30", icon: "flame", value: longest, target: 30 },
    { id: "xp1000", icon: "spark", value: total, target: 1000 },
    { id: "xp5000", icon: "spark", value: total, target: 5000 },
    { id: "master25", icon: "target", value: mastered, target: 25 },
    { id: "mapDone", icon: "flag", value: mapPct, target: 100 },
    { id: "shieldFull", icon: "shield", value: freezes, target: 2 },
  ];

  // 当前查看的月份（默认本月）。不能翻到未来月。
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const atCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const cells = useMemo(() => monthGrid(ym.y, ym.m), [ym.y, ym.m, dailyVersion]);

  const prevMonth = () => setYm(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  const nextMonth = () => {
    if (atCurrent) return;
    setYm(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));
  };

  // 本地化星期表头（周一起头）+ 月份标题 + 日期标题，全用 Intl，免手填 9 语。
  const weekHead = useMemo(() => {
    try {
      const f = new Intl.DateTimeFormat(lang, { weekday: "narrow" });
      return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i))); // 2024-01-01 是周一
    } catch {
      return ["一", "二", "三", "四", "五", "六", "日"];
    }
  }, [lang]);
  const monthLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(lang, { year: "numeric", month: "long" }).format(new Date(ym.y, ym.m, 1));
    } catch {
      return `${ym.y}-${ym.m + 1}`;
    }
  }, [lang, ym]);
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
  const lead = cells.length ? col(cells[0].weekday) : 0;

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

          {/* 等级 / 段位 / 个人纪录 */}
          <section className="streak-card lvl-card">
            <div className="lvl-top">
              <span className="lvl-medal">
                <Icon name="medal" />
              </span>
              <div className="lvl-id">
                <b>Lv {lvl.level}</b>
                <span>{t(`tier.${lvl.tier}`)}</span>
              </div>
              <span className="lvl-xp">{total} XP</span>
            </div>
            <div className="lvl-bar">
              <i style={{ width: `${Math.round(lvl.pct * 100)}%` }} />
            </div>
            <div className="lvl-next">{t("streak.toNext", { n: lvl.toNext })}</div>
            <div className="tier-ladder" role="img" aria-label={t(`tier.${lvl.tier}`)}>
              {TIER_MIN_LEVEL.map((_, i) => (
                <span
                  key={i}
                  className={`tl-seg ${i <= lvl.tier ? "on" : ""} ${i === lvl.tier ? "cur" : ""}`.trim()}
                  title={t(`tier.${i}`)}
                />
              ))}
            </div>
            <div className="tier-hint">
              {lvl.tier < TIER_MIN_LEVEL.length - 1
                ? t("streak.nextTier", { tier: t(`tier.${lvl.tier + 1}`), lv: TIER_MIN_LEVEL[lvl.tier + 1] })
                : t("streak.maxTier")}
            </div>
            <div className="lvl-records">
              <div>
                <b>{longest}</b>
                <span>{t("streak.recMaxStreak")}</span>
              </div>
              <div>
                <b>{best}</b>
                <span>{t("streak.recBestDay")}</span>
              </div>
              <div>
                <b>{mastered}</b>
                <span>{t("streak.recMastered")}</span>
              </div>
            </div>
          </section>
        </div>

        {/* 打卡日历（月历翻页） */}
        <section className="streak-card cal-card">
          <div className="cal-nav">
            <button type="button" className="cal-navbtn" onClick={prevMonth} aria-label={t("streak.prevMonth")}>
              <Icon name="arrow" className="flip" />
            </button>
            <span className="cal-month">{monthLabel}</span>
            <button
              type="button"
              className="cal-navbtn"
              onClick={nextMonth}
              disabled={atCurrent}
              aria-label={t("streak.nextMonth")}
            >
              <Icon name="arrow" />
            </button>
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
              {cells.map((cell) => (
                <span
                  key={cell.date}
                  className={`cal-cell ${cell.future ? "future" : cell.met ? "met" : cell.partial ? "partial" : "miss"} ${cell.frozen ? "frozen" : ""} ${cell.today ? "today" : ""}`.trim()}
                  title={titleOf(cell)}
                >
                  <i className="cal-d">{cell.day}</i>
                  {cell.frozen && <Icon name="shield" className="cal-fz" />}
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

      {/* 成就 */}
      <section className="streak-ach">
        <div className="sc-h">
          <h3>{t("streak.achievements")}</h3>
        </div>
        <div className="ach-grid">
          {achievements.map((a) => {
            const unlocked = a.value >= a.target;
            return (
              <div key={a.id} className={`ach ${unlocked ? "on" : ""}`}>
                <span className="ach-ic">
                  <Icon name={a.icon} />
                </span>
                <div className="ach-t">
                  <b>{t(`ach.${a.id}`)}</b>
                  <span>{unlocked ? t("streak.unlocked") : `${Math.min(a.value, a.target)} / ${a.target}`}</span>
                </div>
                {unlocked && <Icon name="check" className="ach-chk" />}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
