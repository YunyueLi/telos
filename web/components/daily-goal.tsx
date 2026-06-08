"use client";

// 多邻国式激励 v1：今日目标进度环 + 连胜火焰 + 断签保护(freeze) + 35 天打卡日历。
// 设计依据：Duolingo（目标用户自定、连胜按达成今日目标计、freeze 自动桥接缺勤、最多持 2）；
// 习惯类 App 日历热力网格（今日高亮、完成实心、缺勤空心、冻结特异、未来/空格也明确）。
// 动机红线：XP 死绑真实掌握/复习信号；目标可调可"轻松档"、低压力、无愧疚式暗黑模式。
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
      <g className="ring-mid">
        {met ? (
          <path className="ring-chk" d="M13 20.5l4.5 4.5L28 14" />
        ) : (
          <text x="20" y="20" textAnchor="middle" dominantBaseline="central" className="ring-pct">
            {Math.round(pct * 100)}%
          </text>
        )}
      </g>
    </svg>
  );
}

export function DailyGoal() {
  const { t, lang } = useT();
  const { streak, dailyXp, dailyGoal, dailyPct, dailyGoalMet, freezes, calendar, setDailyGoal } = useProject();

  // 本地化星期表头（周一起头，narrow 单字）+ 日期标题，全用 Intl，免手填 9 语。
  const weekHead = useMemo(() => {
    try {
      const f = new Intl.DateTimeFormat(lang, { weekday: "narrow" });
      // 2024-01-01 是周一 → 取周一..周日
      return Array.from({ length: 7 }, (_, i) => f.format(new Date(2024, 0, 1 + i)));
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
    const tail = cell.frozen
      ? ` · ${t("daily.frozen")}`
      : cell.met
        ? ` · ${cell.xp} XP`
        : cell.partial
          ? ` · ${cell.xp} XP`
          : "";
    return `${ds}${tail}`;
  };

  // 周一起头：把 weekday(0=日..6=六) 映射到列(0=周一..6=周日)。首格补空。
  const col = (weekday: number) => (weekday + 6) % 7;
  const lead = calendar.length ? col(calendar[0].weekday) : 0;

  const goalOpts: MenuOption[] = GOAL_OPTIONS.map((g) => ({ value: String(g), label: t(`daily.tier${g}`) }));
  const remain = Math.max(0, dailyGoal - dailyXp);

  return (
    <section className="me-sect daily">
      <div className="me-sh">
        <h3>{t("daily.title")}</h3>
        <span className="daily-streak" title={t("daily.streakTitle")}>
          <Icon name="flame" className={`fl ${streak > 0 ? "on" : ""}`} />
          <b>{streak}</b>
          <s>{t("daily.dayUnit")}</s>
        </span>
      </div>

      {/* 今日目标 */}
      <div className="daily-goalrow">
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

      {/* 断签保护 */}
      <div className="daily-freeze">
        <span className="fz-ic">
          <Icon name="shield" className={freezes > 0 ? "on" : ""} />
        </span>
        <div className="fz-txt">
          <b>{t("daily.freezeN", { n: freezes })}</b>
          <span>{freezes > 0 ? t("daily.freezeOn") : t("daily.freezeOff")}</span>
        </div>
      </div>

      {/* 打卡日历 */}
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
  );
}
