"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";

const TOTAL = 25; // 自适应测评的名义题量

interface Question {
  topic: string; // 定位中的知识点
  prompt: string;
  code?: string;
  options: string[];
  answer: number; // 仅用于演示口吻，不影响导航
}

// 6 道可信的 Python / HTTP / JWT / FastAPI 题，逐题收窄定位
const QUESTIONS: Question[] = [
  {
    topic: "Python 基础",
    prompt: "下面这段代码会输出什么？",
    code: "d = {'a': 1}\nprint(d.get('b', 0))",
    options: ["KeyError", "None", "0", "报错，缺少键"],
    answer: 2,
  },
  {
    topic: "函数与类型",
    prompt: "在类型注解中，表示「可能是 str，也可能是 None」最贴切的写法是？",
    code: "def find(uid: int) -> ___:\n    ...",
    options: ["str | None", "Optional", "Any", "str?"],
    answer: 0,
  },
  {
    topic: "HTTP 基础",
    prompt: "客户端请求一个需要登录、但未携带凭证的资源，最合适的状态码是？",
    options: ["403 Forbidden", "401 Unauthorized", "400 Bad Request", "404 Not Found"],
    answer: 1,
  },
  {
    topic: "JWT 原理",
    prompt: "关于 JWT，下列说法正确的是？",
    options: [
      "payload 经过加密，旁人无法读取",
      "服务器必须查库才能验证 token",
      "签名保证内容未被篡改，但 payload 是明文",
      "token 一旦签发就永久有效",
    ],
    answer: 2,
  },
  {
    topic: "REST 设计",
    prompt: "要「获取 id 为 42 的用户」，符合 REST 风格的是？",
    code: "GET ___",
    options: ["/getUser?id=42", "/users/42", "/user/get/42", "/api?action=user&id=42"],
    answer: 1,
  },
  {
    topic: "FastAPI 路由",
    prompt: "在 FastAPI 中，把路径参数声明为整型的正确写法是？",
    code: "@app.get('/items/{item_id}')\ndef read(item_id: ___):\n    ...",
    options: ["str", "int", "Path", "Query"],
    answer: 1,
  },
];

export default function DiagnosePage() {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const done = i >= QUESTIONS.length;
  const q = done ? null : QUESTIONS[i];
  // 进度按名义 25 题推进，让自适应「收窄」更可信
  const step = done ? TOTAL : Math.round((i / QUESTIONS.length) * (TOTAL - 1)) + 1;
  const pct = done ? 100 : Math.round((step / TOTAL) * 100);

  function choose(idx: number) {
    if (picked !== null) return;
    setPicked(idx);
    window.setTimeout(() => {
      setPicked(null);
      setI((n) => n + 1);
    }, 360);
  }

  return (
    <>
      <SiteHeader />
      <div className="wrap">
        <section>
          <div className="shead">
            <span className="no">00</span>
            <h2>诊断测评</h2>
            <span className="sub">约 25 题，自适应定位你的起点</span>
          </div>
          <div className="cap">
            <span>测评</span>
            <span>telos.app/diagnose</span>
          </div>
          <div className="plate">
            <div className="ptop">
              <span className="u">telos.app/diagnose</span>
              <span className="br">
                <i />
                <i />
                <i />
              </span>
            </div>

            {!done && q && (
              <>
                <div className="dgbar">
                  <span className="mono dgn">
                    第 {step} / {TOTAL}
                  </span>
                  <div className="dgtrack">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <span className="mono dgloc">已定位 {i} 个知识点</span>
                </div>
                <div className="dgbody">
                  <div className="dgq">
                    <div className="dgtopic mono">
                      <Icon name="target" /> 正在定位 · {q.topic}
                    </div>
                    <h3 className="dgprompt">{q.prompt}</h3>
                    {q.code && <pre className="dgcode mono">{q.code}</pre>}
                    <div className="dgopts">
                      {q.options.map((opt, idx) => {
                        const state =
                          picked === null
                            ? ""
                            : idx === picked
                              ? " sel"
                              : " dim";
                        return (
                          <button
                            key={opt}
                            className={`dgopt${state}`}
                            onClick={() => choose(idx)}
                            disabled={picked !== null}
                          >
                            <span className="dgkey mono">
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <span className="dgtxt">{opt}</span>
                            <span className="dgtick">
                              <Icon name="arrow" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <aside className="dgside">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <span className="pmini dgface">
                      <img src={asset("/portraits/think.png")} alt="" />
                    </span>
                    <div className="dgnote mono">题目会随你的作答变难或变易</div>
                    <h4 className="dgsh">已定位</h4>
                    <ul className="dglist">
                      {QUESTIONS.slice(0, i).map((p) => (
                        <li key={p.topic} className="dgli">
                          <Icon name="check" /> {p.topic}
                        </li>
                      ))}
                      {i === 0 && <li className="dgli empty mono">尚未开始</li>}
                    </ul>
                  </aside>
                </div>
              </>
            )}

            {done && (
              <div className="dgdone">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="pcirc dgdoneart">
                  <img src={asset("/portraits/point.png")} alt="Telos 老师" />
                </span>
                <div className="eye mono">诊断完成</div>
                <h2>已生成你的学习地图</h2>
                <p className="dgdonep">
                  我们定位了 {QUESTIONS.length} 个知识点，并按前置依赖排出了你的学习前沿。
                  起点已经为你校准——直接从「现在学」的那一步开始即可。
                </p>
                <div className="dgsum">
                  <div className="dgstat">
                    <span className="num">{QUESTIONS.length}</span>
                    <span className="lab mono">已定位知识点</span>
                  </div>
                  <div className="dgstat">
                    <span className="num">3</span>
                    <span className="lab mono">判定已掌握</span>
                  </div>
                  <div className="dgstat">
                    <span className="num">JWT</span>
                    <span className="lab mono">建议起点</span>
                  </div>
                </div>
                <div className="dgcta">
                  <Link className="btn btn-ink" href="/map">
                    查看学习地图 <Icon name="arrow" />
                  </Link>
                  <button
                    className="btn btn-line"
                    onClick={() => {
                      setI(0);
                      setPicked(null);
                    }}
                  >
                    <Icon name="refresh" /> 重新测评
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
      <footer>
        <div className="wrap">TELOS — 从结果倒推，学会任何事 · 开源 Demo</div>
      </footer>
    </>
  );
}
