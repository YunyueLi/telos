"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { DEMO_GRAPH as G } from "@/lib/graph";

const QUICK = [
  { href: "/map", icon: "map", label: "学习地图", sub: "前置依赖图" },
  { href: "/diagnose", icon: "target", label: "诊断测评", sub: "重新校准起点" },
  { href: "/profile", icon: "user", label: "个人中心", sub: "进度与成就" },
] as const;

export default function HomePage() {
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
              <div className="l mono">推荐下一步 · 你的学习前沿</div>
              <h3 className="ht">JWT 原理</h3>
              <div className="hmeta mono">
                <span>
                  <Icon name="play" /> 现在学
                </span>
                <span>
                  <Icon name="clock" /> 约 25 分钟
                </span>
                <span>前置已全部掌握</span>
              </div>
              <p className="hd">
                还记得你掌握的 HTTP 基础里的 Cookie 吗？JWT 就像一张「自带防伪钢印的 Cookie」——
                学完它，FastAPI 路由 与 鉴权中间件 会解锁。
              </p>
              <Link
                className="btn btn-light"
                href="/learn/jwt"
                style={{ justifyContent: "center", width: "100%" }}
              >
                开始学习 <Icon name="arrow" />
              </Link>
            </div>

            <div className="hcol">
              <div className="hcard">
                <div className="hch">
                  <h4 className="mono">今日待复习</h4>
                  <span className="hcn mono">{G.due.length} 项</span>
                </div>
                <div className="hdue">
                  {G.due.map((d) => (
                    <button key={d.label} className="hr">
                      <span className="hricon">
                        <Icon name="refresh" />
                      </span>
                      <b>{d.label}</b>
                      <span className="t mono">{d.note}</span>
                    </button>
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
                    {G.masteredCount}
                    <sup> / {G.totalCount}</sup>
                  </div>
                  <div className="hpgoal">
                    个知识点已掌握
                    <span className="mono">{G.goal}</span>
                  </div>
                </div>
                <div className="bar2">
                  <i />
                </div>
                <div className="hpeta mono">按当前节奏 · 预计 {G.etaDays} 天达成</div>
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
