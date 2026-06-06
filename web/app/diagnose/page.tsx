"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { Diagnosis, SEED_GRAPH, emptyState, learningFrontier } from "@/lib/telos/engine";
import { useLearner } from "@/lib/telos/store";

interface Q {
  topic: string;
  prompt: string;
  code?: string;
  options: string[];
  answer: number;
}

// One question per knowledge point; the engine decides which to ask next (adaptive).
const BANK: Record<string, Q> = {
  py: {
    topic: "Python 基础",
    prompt: "下面这段代码会输出什么？",
    code: "d = {'a': 1}\nprint(d.get('b', 0))",
    options: ["KeyError", "None", "0", "报错，缺少键"],
    answer: 2,
  },
  types: {
    topic: "函数与类型",
    prompt: "表示「可能是 str，也可能是 None」最贴切的类型注解是？",
    code: "def find(uid: int) -> ___:\n    ...",
    options: ["str | None", "Optional", "Any", "str?"],
    answer: 0,
  },
  http: {
    topic: "HTTP 基础",
    prompt: "请求一个需要登录、但未携带凭证的资源，最合适的状态码是？",
    options: ["403 Forbidden", "401 Unauthorized", "400 Bad Request", "404 Not Found"],
    answer: 1,
  },
  jwt: {
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
  rest: {
    topic: "REST 设计",
    prompt: "要「获取 id 为 42 的用户」，符合 REST 风格的是？",
    code: "GET ___",
    options: ["/getUser?id=42", "/users/42", "/user/get/42", "/api?action=user&id=42"],
    answer: 1,
  },
  route: {
    topic: "FastAPI 路由",
    prompt: "在 FastAPI 中，把路径参数声明为整型的正确写法是？",
    code: "@app.get('/items/{item_id}')\ndef read(item_id: ___):\n    ...",
    options: ["str", "int", "Path", "Query"],
    answer: 1,
  },
  mw: {
    topic: "鉴权中间件",
    prompt: "给一组路由统一加上「必须登录」，FastAPI 里最合适的做法是？",
    options: [
      "在每个函数里复制粘贴检查",
      "用依赖项 Depends 注入鉴权",
      "改前端隐藏入口",
      "写在文档里提醒用户",
    ],
    answer: 1,
  },
  deploy: {
    topic: "部署上线",
    prompt: "把 FastAPI 应用部署到生产，通常怎么跑？",
    options: [
      "python app.py 直接跑",
      "用 ASGI 服务器（uvicorn / gunicorn）+ 反向代理",
      "拷进 Jupyter 运行",
      "FTP 上传到虚拟主机",
    ],
    answer: 1,
  },
};

export default function DiagnosePage() {
  const { applyDiagnosis } = useLearner();
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);

  // Replay answers to let the engine pick the current (most informative) question.
  const diag = new Diagnosis(SEED_GRAPH);
  for (const id of order) diag.answer(id, answers[id]);
  const currentPid = diag.nextQuestion();
  const done = currentPid === null;
  const q = currentPid ? BANK[currentPid] : null;

  const total = SEED_GRAPH.ids().length;
  const step = Math.min(order.length + 1, total);
  const pct = done ? 100 : Math.round((order.length / total) * 100);

  // Persist the diagnosed state once, when the run finishes.
  useEffect(() => {
    if (done && order.length > 0) applyDiagnosis(answers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const masteredJudged = SEED_GRAPH.ids().filter((id) => diag.belief[id] >= 0.6).length;
  const suggest = (() => {
    const st = emptyState();
    for (const id of SEED_GRAPH.ids()) st.mastery[id] = diag.belief[id];
    const f = learningFrontier(SEED_GRAPH, st)[0];
    return f ? SEED_GRAPH.get(f[0]).name : "—";
  })();

  function choose(idx: number) {
    if (picked !== null || !currentPid || !q) return;
    setPicked(idx);
    const correct = idx === q.answer;
    const pidNow = currentPid;
    window.setTimeout(() => {
      setAnswers((a) => ({ ...a, [pidNow]: correct }));
      setOrder((o) => [...o, pidNow]);
      setPicked(null);
    }, 360);
  }

  function restart() {
    setAnswers({});
    setOrder([]);
    setPicked(null);
  }

  return (
    <>
      <SiteHeader />
      <div className="wrap">
        <section>
          <div className="shead">
            <span className="no">00</span>
            <h2>诊断测评</h2>
            <span className="sub">自适应 · 测到有把握为止</span>
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
                    第 {step} / {total}
                  </span>
                  <div className="dgtrack">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <span className="mono dgloc">已定位 {order.length} 个知识点</span>
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
                        const cls = picked === null ? "" : idx === picked ? " sel" : " dim";
                        return (
                          <button
                            key={opt}
                            className={`dgopt${cls}`}
                            onClick={() => choose(idx)}
                            disabled={picked !== null}
                          >
                            <span className="dgkey mono">{String.fromCharCode(65 + idx)}</span>
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
                      {order.map((pid) => (
                        <li key={pid} className="dgli">
                          <Icon name="check" /> {BANK[pid]?.topic ?? pid}
                        </li>
                      ))}
                      {order.length === 0 && <li className="dgli empty mono">尚未开始</li>}
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
                  我们定位了 {order.length} 个知识点，按前置依赖排出了你的学习前沿，并把结果记入了你的学习状态——
                  地图、首页、个人中心都会随之更新。
                </p>
                <div className="dgsum">
                  <div className="dgstat">
                    <span className="num">{order.length}</span>
                    <span className="lab mono">已定位知识点</span>
                  </div>
                  <div className="dgstat">
                    <span className="num">{masteredJudged}</span>
                    <span className="lab mono">判定已掌握</span>
                  </div>
                  <div className="dgstat">
                    <span className="num">{suggest}</span>
                    <span className="lab mono">建议起点</span>
                  </div>
                </div>
                <div className="dgcta">
                  <Link className="btn btn-ink" href="/map">
                    查看学习地图 <Icon name="arrow" />
                  </Link>
                  <button className="btn btn-line" onClick={restart}>
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
