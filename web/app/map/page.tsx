"use client";

import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { DEMO_GRAPH as G } from "@/lib/graph";
import { useLearner } from "@/lib/telos/store";

export default function MapPage() {
  const router = useRouter();
  const L = useLearner();
  const nowNode = G.nodes.find((n) => L.visual[n.id] === "now");

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
                <img src={asset("/portraits/avatar.png")} alt="" />
              </span>
              <span className="hi">
                继续，Alex
                <span>
                  {G.goal} · 倒推出 {L.total} 个知识点
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
                    {nowNode && (
                      <ellipse className="ring" cx={nowNode.x} cy={nowNode.y} rx={84} ry={42} />
                    )}
                  </svg>
                  {G.nodes.map((n) => (
                    <div
                      key={n.id}
                      className={`n ${L.visual[n.id]}`}
                      style={{ left: n.x, top: n.y }}
                    >
                      {n.label}
                      <s>{L.sub[n.id]}</s>
                    </div>
                  ))}
                  {nowNode && (
                    <div className="nowtag" style={{ left: nowNode.x + 52, top: nowNode.y - 66 }}>
                      ↙ 你的学习前沿
                    </div>
                  )}
                </div>
              </div>
              <div className="aside">
                <h4>你的进度</h4>
                <div className="big">
                  {L.mastered}
                  <sup> / {L.total}</sup>
                </div>
                <div className="bar2">
                  <i style={{ width: `${L.pct}%` }} />
                </div>
                <div
                  style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--ink-3)" }}
                >
                  按当前节奏 · 预计 {L.etaDays} 天达成
                </div>
                {L.next && (
                  <div className="dark nextc">
                    <svg className="contour skL" viewBox="0 0 300 180" preserveAspectRatio="none">
                      <g stroke="currentColor" fill="none" strokeWidth="1.4" opacity="0.13">
                        <path d="M-10 40C80 20 160 60 310 30" />
                        <path d="M-10 90C80 70 160 110 310 80" />
                        <path d="M-10 140C80 120 160 160 310 130" />
                      </g>
                    </svg>
                    <div className="l">推荐下一步</div>
                    <div className="t">{L.next.name}</div>
                    <div className="d">前置已全部掌握，正处你的学习前沿。约 {L.next.minutes} 分钟。</div>
                    <button
                      className="btn btn-light"
                      style={{ width: "100%", justifyContent: "center", marginTop: 13 }}
                      onClick={() => router.push(`/learn/${L.next!.id}`)}
                    >
                      开始学习 <Icon name="arrow" />
                    </button>
                  </div>
                )}
                <div className="due">
                  <h4>今日待复习</h4>
                  {L.due.length === 0 && (
                    <div className="r" style={{ color: "var(--ink-3)" }}>
                      <Icon name="check" />
                      <span>今日无待复习</span>
                    </div>
                  )}
                  {L.due.map((d) => (
                    <div key={d.id} className="r">
                      <Icon name="refresh" />
                      <b>{d.name}</b>
                      <span className="t">该复习</span>
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
