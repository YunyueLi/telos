"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icon";

const DASH = 163; // 2π·26, the gauge circle circumference

export default function LessonPage() {
  const [ran, setRan] = useState(false);
  const mastery = ran ? 90 : 72;
  const offset = Math.round(DASH * (1 - mastery / 100));

  return (
    <>
      <SiteHeader />
      <div className="wrap">
        <section>
          <div className="shead">
            <span className="no">03</span>
            <h2>学习中</h2>
            <span className="sub">定制讲解 · 用你已会的类比 · 跑测试验证</span>
          </div>
          <div className="cap">
            <span>课程</span>
            <span>telos.app/learn/jwt</span>
          </div>
          <div className="plate">
            <div className="dark lhead">
              <svg className="contour skL" viewBox="0 0 900 200" preserveAspectRatio="none">
                <g stroke="currentColor" fill="none" strokeWidth="1.5" opacity="0.12">
                  <path d="M-20 50C220 20 460 80 920 40" />
                  <path d="M-20 100C220 70 460 130 920 90" />
                  <path d="M-20 150C220 120 460 180 920 140" />
                </g>
              </svg>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="pcirc">
                <img src="/portraits/teach.png" alt="Telos 老师" />
              </span>
              <div>
                <div className="m">学习前沿 · 为你定制 · 第 3 / 4 步</div>
                <h2>动手：签发一个 JWT</h2>
                <div className="pills">
                  <span className="pill">什么是 token ✓</span>
                  <span className="pill">签名与篡改 ✓</span>
                  <span className="pill on">动手：签发</span>
                  <span className="pill">掌握验证</span>
                </div>
              </div>
            </div>
            <div className="lbody">
              <div className="lmain">
                <p>
                  JWT 就是一段「带签名的 JSON」。服务器把用户信息写进去，再用密钥签名；之后任何人都能读，但只有持密钥者能伪造。
                </p>
                <div className="analogy">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <span className="pmini">
                    <img src="/portraits/think.png" alt="" />
                  </span>
                  <div>
                    <div className="l">用你已会的来理解</div>
                    <p>
                      还记得你掌握的 <b>HTTP 基础</b> 里的 Cookie 吗？JWT 就像一张「自带防伪钢印的
                      Cookie」——服务器不查库，验下钢印就知真假。
                    </p>
                  </div>
                </div>
                <div className="code">
                  <span className="c"># 用 PyJWT 签发一个 token</span>
                  <br />
                  <span className="k">import</span> jwt
                  <br />
                  token = jwt.<span className="k">encode</span>(
                  <br />
                  &nbsp;&nbsp;{"{"}
                  <span className="s">&quot;user_id&quot;</span>: 42,{" "}
                  <span className="s">&quot;role&quot;</span>: <span className="s">&quot;admin&quot;</span>
                  {"}"},
                  <br />
                  &nbsp;&nbsp;<span className="s">&quot;my-secret-key&quot;</span>, algorithm=
                  <span className="s">&quot;HS256&quot;</span>
                  <br />)
                </div>
                <div className="runbar">
                  <button className="btn btn-ink" onClick={() => setRan(true)}>
                    <Icon name="play" /> 运行测试
                  </button>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>
                    通过测试 = 客观确认掌握
                  </span>
                </div>
                {ran && (
                  <div className="pass">
                    <Icon name="check" /> 2/2 测试通过 · token 可正确解码且签名有效 — 掌握度 +18%
                  </div>
                )}
              </div>
              <div className="lside">
                <h4>为什么学这个</h4>
                <div className="why">
                  你的目标 <b>带 JWT 鉴权的 API</b> 直接依赖它。学完它，<b>FastAPI 路由</b> 与{" "}
                  <b>鉴权中间件</b> 会解锁。
                </div>
                <h4>当前掌握度</h4>
                <div className="gauge">
                  <div className="g">
                    <svg viewBox="0 0 64 64">
                      <circle className="tk" cx="32" cy="32" r="26" />
                      <circle className="fg" cx="32" cy="32" r="26" style={{ strokeDashoffset: offset }} />
                    </svg>
                    <span className="v">{mastery}%</span>
                  </div>
                  <div className="lab">
                    {ran ? (
                      <>
                        已达标
                        <br />
                        本节
                        <br />
                        <b style={{ fontWeight: 600 }}>已掌握</b>
                      </>
                    ) : (
                      <>
                        再做对 1 道
                        <br />
                        即标记为
                        <br />
                        <b style={{ fontWeight: 600 }}>已掌握</b>
                      </>
                    )}
                  </div>
                </div>
                <h4 style={{ marginTop: 24 }}>本节覆盖</h4>
                <div className="why">token 结构 · HS256 签名 · 过期校验</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
