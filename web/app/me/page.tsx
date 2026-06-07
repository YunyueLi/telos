"use client";

// 我：资料 + 真实 XP/连胜/掌握分组 + 设置（倒推端点 / 重测起点 / 换目标）+ 跨设备备份。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { AppShell } from "@/components/app-shell";
import { useProject } from "@/lib/telos/use-project";
import { domainLabel } from "@/lib/telos/engine";
import { getDeriveUrl, setDeriveUrl } from "@/lib/telos/derive";
import { loadProject, saveProject } from "@/lib/telos/project";

const GROUPS = [
  { key: "done", title: "已掌握" },
  { key: "now", title: "现在学" },
  { key: "learn", title: "学习中" },
  { key: "lock", title: "未解锁" },
] as const;

export default function MePage() {
  const router = useRouter();
  const { ready, project, graph, view, xp, streak, reset } = useProject();

  const [mounted, setMounted] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const [savedUrl, setSavedUrl] = useState("");
  const [backup, setBackup] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setMounted(true);
    const u = getDeriveUrl();
    setUrlDraft(u);
    setSavedUrl(u);
  }, []);

  const saveCfg = () => {
    setDeriveUrl(urlDraft);
    setSavedUrl(urlDraft.trim());
    setMsg("端点已保存");
  };
  const doExport = () => {
    const p = loadProject();
    if (!p) {
      setMsg("还没有项目可备份");
      return;
    }
    setBackup(JSON.stringify(p));
    setMsg("已生成备份码 —— 复制保存，换设备粘贴导入即可");
  };
  const doImport = () => {
    try {
      const p = JSON.parse(backup);
      if (!p || !Array.isArray(p.points)) throw new Error();
      saveProject(p);
      setMsg("已导入 —— 即将刷新");
      setTimeout(() => window.location.reload(), 600);
    } catch {
      setMsg("备份码无效");
    }
  };
  const changeGoal = () => {
    if (window.confirm("换一个目标会清空当前项目的学习进度。继续？")) {
      reset();
      router.push("/");
    }
  };

  if (!ready) {
    return (
      <AppShell active="me">
        <div className="loadrow" style={{ flex: 1, justifyContent: "center" }}>
          <span className="spinner" /> 载入中…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="me">
      <div className="me">
        <div className="me-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <span className="pcirc">
            <img src={asset("/portraits/reading.png")} alt="" />
          </span>
          <div className="info">
            <div className="eyebrow">Telos 学员</div>
            <h2>本地学习档案</h2>
            {project ? (
              <p className="me-goal">目标：{project.goal}</p>
            ) : (
              <p className="me-goal">还没有目标 —— 去地图说一个，开始倒推。</p>
            )}
            <div className="me-tags">
              <span className="me-tag">
                <Icon name="spark" /> 连胜 {streak} 天
              </span>
              {view && (
                <span className="me-tag">
                  <Icon name="target" /> 进度 {view.mastered}/{view.total}
                </span>
              )}
              <span className="me-tag">{xp} XP</span>
            </div>
          </div>
        </div>

        {view && (
          <div className="me-stats">
            <div className="me-stat">
              <span className="num">
                {view.mastered}
                <span style={{ fontSize: 16, color: "var(--ink-3)" }}>/{view.total}</span>
              </span>
              <span className="lab">已掌握</span>
            </div>
            <div className="me-stat">
              <span className="num">{streak}</span>
              <span className="lab">连胜天数</span>
            </div>
            <div className="me-stat">
              <span className="num">{xp}</span>
              <span className="lab">XP</span>
            </div>
            <div className="me-stat">
              <span className="num">{view.pct}%</span>
              <span className="lab">目标完成度</span>
            </div>
          </div>
        )}

        <div className="me-2col">
          {/* 掌握进度 */}
          <div>
            <div className="me-sect" style={{ marginTop: 0 }}>
              <div className="me-sh">
                <h3>掌握进度</h3>
                {project && (
                  <Link className="sectlabel right" href="/" style={{ display: "inline-flex", gap: 6 }}>
                    在地图查看 <Icon name="arrow" style={{ width: 12, height: 12 }} />
                  </Link>
                )}
              </div>
              {!project || !graph || !view ? (
                <p className="me-note">还没有项目。去地图定个目标，能力点会出现在这里。</p>
              ) : (
                GROUPS.map((grp) => {
                  const items = graph.ids().filter((id) => view.visual[id] === grp.key);
                  if (items.length === 0) return null;
                  return (
                    <div key={grp.key} className="me-grp">
                      <div className="me-glab">
                        <span className={`stt ${grp.key}`} />
                        {grp.title}
                        <span className="c">{items.length}</span>
                      </div>
                      <div className="me-chips">
                        {items.map((id) => (
                          <span key={id} className={`me-chip ${grp.key}`}>
                            {graph.get(id).name}
                            <s>{domainLabel(graph.get(id).domain)}</s>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 设置 + 备份 */}
          <div>
            <div className="me-sect" style={{ marginTop: 0 }}>
              <div className="me-sh">
                <h3>设置</h3>
              </div>
              <div className="me-set">
                <button className="me-row" onClick={() => router.push("/diagnose")} disabled={!project}>
                  <Icon name="spark" className="ic" />
                  <span className="l">重新测起点</span>
                  <span className="v">CBM 诊断</span>
                </button>
                <button className="me-row" onClick={changeGoal} disabled={!project}>
                  <Icon name="refresh" className="ic" />
                  <span className="l">换个目标</span>
                  <span className="v">清空进度</span>
                </button>
              </div>

              {mounted && (
                <>
                  <div className="me-note" style={{ marginTop: 18 }}>
                    倒推 / 微课 / 诊断的服务端点（本地 serve.py 或线上 Worker）。Key 永远在服务端，不进前端。
                  </div>
                  <div className="me-field">
                    <input
                      placeholder="http://127.0.0.1:8787/derive"
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                    />
                    <button className="btn btn-ink" style={{ padding: "9px 15px" }} onClick={saveCfg}>
                      保存
                    </button>
                  </div>
                  <div className="me-note">
                    {savedUrl ? `当前：${savedUrl}` : "未配置 —— 倒推与学习需要它，见 DERIVE.md。"}
                  </div>
                </>
              )}
            </div>

            <div className="me-sect">
              <div className="me-sh">
                <h3>跨设备 · 备份</h3>
              </div>
              <div className="me-note" style={{ marginTop: 0 }}>
                导出当前项目为「备份码」，换设备粘贴导入即可，无需联网。
              </div>
              <div className="me-field">
                <button className="btn btn-line" style={{ padding: "9px 14px" }} onClick={doExport} disabled={!project}>
                  <Icon name="up" /> 导出
                </button>
                <button className="btn btn-line" style={{ padding: "9px 14px" }} onClick={doImport} disabled={!backup.trim()}>
                  <Icon name="arrow" /> 导入
                </button>
              </div>
              <textarea
                className="mono"
                value={backup}
                onChange={(e) => setBackup(e.target.value)}
                placeholder="备份码会显示在这里；也可粘贴备份码后点「导入」"
                rows={4}
                style={{
                  width: "100%",
                  marginTop: 10,
                  border: "1px solid var(--line-soft)",
                  borderRadius: 12,
                  background: "var(--paper)",
                  padding: 12,
                  fontSize: 11,
                  color: "var(--ink-2)",
                  resize: "vertical",
                }}
              />
              <div className="me-dark dark" style={{ marginTop: 14 }}>
                <div className="l">云同步 · 开发中</div>
                <p>接一个免费 Supabase 项目即可账号登录、跨设备自动同步（全程你操作，我们不存你的密钥）。</p>
                <a
                  className="btn btn-light"
                  href="https://github.com/YunyueLi/telos/blob/main/SUPABASE.md"
                  target="_blank"
                  rel="noreferrer"
                  style={{ justifyContent: "center", width: "100%" }}
                >
                  查看启用步骤 <Icon name="arrow" />
                </a>
              </div>

              {msg && <div className="me-msg">{msg}</div>}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
