"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { DEMO_GRAPH as G } from "@/lib/graph";
import { useLearner } from "@/lib/telos/store";

const QUICK = [
  { href: "/map", icon: "map", label: "学习地图", sub: "前置依赖图" },
  { href: "/review", icon: "refresh", label: "复习", sub: "间隔重复" },
  { href: "/profile", icon: "user", label: "个人中心", sub: "进度与成就" },
  { href: "/account", icon: "user", label: "账号 · 备份", sub: "档案 / 云同步" },
] as const;

export default function HomePage() {
  const L = useLearner();

  return (
    <>
      <SiteHeader />
      <div className="wrap">
        <section>
          <div className="shead">
            <span className="no">00</span>
            <h2>今天</h2>
            <span className="sub">继续，按前沿往前一步</span>
          </div>

          <div className="hgreet">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="pmini hgface">
              <img src={asset("/portraits/welcome.png")} alt="" />
            </span>
            <div className="hgt">
              继续学习，Alex
              <span className="mono">连续 6 天 · 保持节奏</span>
            </div>
            <span className="hgstreak mono">
              <Icon name="spark" /> 6 天
            </span>
          </div>

          <div className="hgrid">
            <div className="dark hnext">
              <svg className="contour skL" viewBox="0 0 600 260" preserveAspectRatio="none">
                <g stroke="currentColor" fill="none" strokeWidth="1.5" opacity="0.12">
                  <path d="M-20 60C160 30 320 90 620 50" />
                  <path d="M-20 120C160 90 320 150 620 110" />
                  <path d="M-20 180C160 150 320 210 620 170" />
                </g>
              </svg>
              {L.next ? (
                <>
                  <div className="l mono">推荐下一步 · 你的学习前沿</div>
                  <h3 className="ht">{L.next.name}</h3>
                  <div className="hmeta mono">
                    <span>
                      <Icon name="play" /> 现在学
                    </span>
                    <span>
                      <Icon name="clock" /> 约 {L.next.minutes} 分钟
                    </span>
                    <span>前置已全部掌握</span>
                  </div>
                  <p className="hd">
                    {L.next.id === "jwt"
                      ? "还记得你掌握的 HTTP 基础里的 Cookie 吗？JWT 就像一张「自带防伪钢印的 Cookie」——学完它，FastAPI 路由 与 鉴权中间件 会解锁。"
                      : "它的前置你都已掌握，正处在你的学习前沿——学完会解锁后续的知识点。"}
                  </p>
                  <Link
                    className="btn btn-light"
                    href={`/learn/${L.next.id}`}
                    style={{ justifyContent: "center", width: "100%" }}
                  >
                    开始学习 <Icon name="arrow" />
                  </Link>
                </>
              ) : (
                <>
                  <div className="l mono">目标达成</div>
                  <h3 className="ht">你已抵达目标</h3>
                  <p className="hd">所有前沿知识点都已掌握。接下来保持间隔复习，巩固长期记忆。</p>
                  <Link
                    className="btn btn-light"
                    href="/map"
                    style={{ justifyContent: "center", width: "100%" }}
                  >
                    查看地图 <Icon name="arrow" />
                  </Link>
                </>
              )}
            </div>

            <div className="hcol">
              <div className="hcard">
                <div className="hch">
                  <h4 className="mono">今日待复习</h4>
                  <span className="hcn mono">{L.due.length} 项</span>
                </div>
                <div className="hdue">
                  {L.due.length === 0 && <p className="hhint mono">今日无待复习 · 保持节奏</p>}
                  {L.due.map((d) => (
                    <Link key={d.id} className="hr" href={`/learn/${d.id}`}>
                      <span className="hricon">
                        <Icon name="refresh" />
                      </span>
                      <b>{d.name}</b>
                      <span className="t mono">该复习</span>
                    </Link>
                  ))}
                </div>
                <p className="hhint mono">间隔重复 · 在遗忘前轻触一遍</p>
              </div>

              <div className="hcard">
                <div className="hch">
                  <h4 className="mono">目标进度</h4>
                  <span className="hcn mono">FastAPI · JWT</span>
                </div>
                <div className="hprog">
                  <div className="big">
                    {L.mastered}
                    <sup> / {L.total}</sup>
                  </div>
                  <div className="hpgoal">
                    个知识点已掌握
                    <span className="mono">{G.goal}</span>
                  </div>
                </div>
                <div className="bar2">
                  <i style={{ width: `${L.pct}%` }} />
                </div>
                <div className="hpeta mono">按当前节奏 · 预计 {L.etaDays} 天达成</div>
              </div>
            </div>
          </div>

          <div className="hquick">
            {QUICK.map((q) => (
              <Link key={q.href} className="hq" href={q.href}>
                <span className="hqi">
                  <Icon name={q.icon} />
                </span>
                <span className="hql">
                  {q.label}
                  <span className="mono">{q.sub}</span>
                </span>
                <span className="hqa">
                  <Icon name="arrow" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <footer>
        <div className="wrap">TELOS — 从结果倒推，学会任何事 · 开源 Demo</div>
      </footer>
    </>
  );
}
