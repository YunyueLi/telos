"use client";

import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icon";
import { DEMO_GRAPH as G } from "@/lib/graph";

export default function MapPage() {
  const router = useRouter();

  return (
    <>
      <SiteHeader />
      <div className="wrap">
        <section>
          <div className="shead">
            <span className="no">02</span>
            <h2>学习地图</h2>
            <span className="sub">前置依赖图 + 学习前沿</span>
          </div>
          <div className="cap">
            <span>图谱</span>
            <span>telos.app/map</span>
          </div>
          <div className="plate">
            <div className="ptop">
              <span className="u">telos.app/map</span>
              <span className="br">
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="mtop">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="pmini">
                <img src="/portraits/avatar.png" alt="" />
              </span>
              <span className="hi">
                继续，Alex
                <span>
                  {G.goal} · 倒推出 {G.derivedCount} 个知识点
                </span>
              </span>
              <div className="leg">
                <span>
                  <i className="d" />
                  已掌握
                </span>
                <span>
                  <i />
                  现在学
                </span>
                <span>
                  <i className="l" />
                  学习中
                </span>
                <span>
                  <i className="k" />
                  未解锁
                </span>
              </div>
            </div>
            <div className="mbody">
              <div className="stagewrap">
                <div className="stage">
                  <svg className="net skL" viewBox="0 0 720 430">
                    {G.edges.map((e, i) => (
                      <path key={`e${i}`} className={e.cls} d={e.d} />
                    ))}
                    {G.arrows.map((a, i) => (
                      <path key={`a${i}`} className={a.cls} d={a.d} />
                    ))}
                    <ellipse className="ring" cx={300} cy={214} rx={84} ry={42} />
                  </svg>
                  {G.nodes.map((n) => (
                    <div
                      key={n.id}
                      className={`n ${n.status}`}
                      style={{ left: n.x, top: n.y }}
                    >
                      {n.label}
                      <s>{n.sub}</s>
                    </div>
                  ))}
                  <div className="nowtag" style={{ left: 352, top: 148 }}>
                    ↙ 你的学习前沿
                  </div>
                </div>
              </div>
              <div className="aside">
                <h4>你的进度</h4>
                <div className="big">
                  {G.masteredCount}
                  <sup> / {G.totalCount}</sup>
                </div>
                <div className="bar2">
                  <i />
                </div>
                <div
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "10.5px",
                    color: "var(--ink-3)",
                  }}
                >
                  按当前节奏 · 预计 {G.etaDays} 天达成
                </div>
                <div className="dark nextc">
                  <svg
                    className="contour skL"
                    viewBox="0 0 300 180"
                    preserveAspectRatio="none"
                  >
                    <g stroke="currentColor" fill="none" strokeWidth="1.4" opacity="0.13">
                      <path d="M-10 40C80 20 160 60 310 30" />
                      <path d="M-10 90C80 70 160 110 310 80" />
                      <path d="M-10 140C80 120 160 160 310 130" />
                    </g>
                  </svg>
                  <div className="l">推荐下一步</div>
                  <div className="t">{G.next.title}</div>
                  <div className="d">{G.next.desc}</div>
                  <button
                    className="btn btn-light"
                    style={{ width: "100%", justifyContent: "center", marginTop: 13 }}
                    onClick={() => router.push(`/learn/${G.next.id}`)}
                  >
                    开始学习 <Icon name="arrow" />
                  </button>
                </div>
                <div className="due">
                  <h4>今日待复习</h4>
                  {G.due.map((d) => (
                    <div key={d.label} className="r">
                      <Icon name="refresh" />
                      <b>{d.label}</b>
                      <span className="t">{d.note}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
