"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icon";

const EXAMPLES = [
  "看懂并复现一篇 Transformer 论文",
  "两周内能用 React 独立做个网站",
  "通过 AWS 解决方案架构师认证",
];

const DEFAULT_GOAL = "用 FastAPI 写一个带 JWT 鉴权的 REST API，并部署上线";

export default function GoalPage() {
  const router = useRouter();
  const [goal, setGoal] = useState(DEFAULT_GOAL);

  function derive() {
    if (!goal.trim()) return;
    // Demo：倒推暂用预置的 FastAPI / JWT 示例图谱
    router.push("/map");
  }

  return (
    <>
      <SiteHeader />
      <div className="wrap">
        <section>
          <div className="shead">
            <span className="no">01</span>
            <h2>目标输入</h2>
            <span className="sub">说出目标，而非逐条提问</span>
          </div>
          <div className="cap">
            <span>新建</span>
            <span>telos.app/new</span>
          </div>
          <div className="plate">
            <div className="ptop">
              <span className="u">telos.app/new</span>
              <span className="br">
                <i />
                <i />
                <i />
              </span>
            </div>
            <div className="goal">
              <div>
                <div className="eye">TELOS</div>
                <h2>你想达成什么？</h2>
                <div className="gbox">
                  <textarea
                    className="txt"
                    rows={2}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="例如：用 FastAPI 写一个带 JWT 鉴权的 REST API，并部署上线"
                  />
                  <div className="bar">
                    <span className="chip">
                      <Icon name="clock" /> 2 周
                    </span>
                    <span className="chip">
                      <Icon name="gauge" /> 能独立做出
                    </span>
                    <button
                      className="btn btn-ink"
                      style={{ marginLeft: "auto", padding: "11px 18px" }}
                      onClick={derive}
                      disabled={!goal.trim()}
                    >
                      倒推 <Icon name="arrow" />
                    </button>
                  </div>
                </div>
                <div className="egs">
                  {EXAMPLES.map((e) => (
                    <button key={e} className="e" onClick={() => setGoal(e)}>
                      <Icon name="arrow" /> {e}
                    </button>
                  ))}
                </div>
              </div>
              <div className="goalart">
                <svg className="deco skL" viewBox="0 0 300 330">
                  <circle cx="150" cy="160" r="140" strokeDasharray="2 10" />
                  <path d="M270 120l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" />
                  <path d="M28 230l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" />
                  <path d="M250 250c8-6 16-6 22 0" strokeWidth="2.2" />
                </svg>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="pcirc">
                  <img src="/portraits/present.png" alt="Telos 老师" />
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
      <footer>
        <div className="wrap">TELOS — 从结果倒推，学会任何事 · 开源 Demo</div>
      </footer>
    </>
  );
}
