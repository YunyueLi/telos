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
import { EndpointConfig } from "@/components/endpoint-config";
import { genId, loadActive, setActiveId, upsertProject, type Project } from "@/lib/telos/project";

function progressOf(p: Project): { mastered: number; total: number } {
  const total = p.points.length;
  const mastered = p.points.filter((k) => (p.state.mastery[k.id] ?? 0) >= 0.8).length;
  return { mastered, total };
}

const GROUPS = [
  { key: "done", title: "已掌握" },
  { key: "now", title: "现在学" },
  { key: "learn", title: "学习中" },
  { key: "lock", title: "未解锁" },
] as const;

export default function MePage() {
  const router = useRouter();
  const {
    ready,
    project,
    graph,
    view,
    xp,
    streak,
    projects,
    switchProject,
    removeProject,
    startNew,
  } = useProject();

  const [mounted, setMounted] = useState(false);
  const [backup, setBackup] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const doExport = () => {
    const p = loadActive();
    if (!p) {
      setMsg("还没有项目可备份");
      return;
    }
    setBackup(JSON.stringify(p));
    setMsg("已生成备份码 —— 复制保存，换设备粘贴导入即可");
  };
  const doImport = () => {
    try {
      const p = JSON.parse(backup) as Project;
      if (!p || !Array.isArray(p.points) || !p.points.length) throw new Error();
      const now = Date.now();
      const proj: Project = { ...p, id: p.id || genId(), createdAt: p.createdAt || now, updatedAt: now };
      upsertProject(proj);
      setActiveId(proj.id);
      setMsg("已导入 —— 即将刷新");
      setTimeout(() => window.location.reload(), 600);
    } catch {
      setMsg("备份码无效");
    }
  };
  const newLearning = () => {
    startNew();
    router.push("/");
  };
  const remove = (id: string, goal: string) => {
    if (window.confirm(`删除「${goal}」及其学习进度？此操作不可撤销。`)) removeProject(id);
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

        {/* 我的学习 —— 项目库（存放 / 沉淀 / 切换） */}
        <div className="me-sect">
          <div className="me-sh">
            <h3>我的学习 · {projects.length}</h3>
            <button className="appnew" style={{ marginLeft: "auto" }} onClick={newLearning}>
              <Icon name="plus" /> 新学习
            </button>
          </div>
          {projects.length === 0 ? (
            <p className="me-note">还没有学习项目。点「新学习」说一个目标即可开始。</p>
          ) : (
            <div className="me-projects">
              {projects.map((p) => {
                const pr = progressOf(p);
                const active = project?.id === p.id;
                return (
                  <div key={p.id} className={`me-proj ${active ? "on" : ""}`}>
                    <button
                      className="me-proj-main"
                      onClick={() => {
                        switchProject(p.id);
                        router.push("/");
                      }}
                    >
                      <span className="me-proj-goal">{p.goal}</span>
                      <span className="me-proj-meta">
                        {active && <i className="me-proj-dot" />}
                        {pr.mastered}/{pr.total} 已掌握{active ? " · 当前" : ""}
                      </span>
                    </button>
                    <button
                      className="me-proj-del"
                      onClick={() => remove(p.id, p.goal)}
                      title="删除项目"
                      aria-label="删除项目"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
                <button className="me-row" onClick={newLearning}>
                  <Icon name="plus" className="ic" />
                  <span className="l">新学习</span>
                  <span className="v">保留现有项目</span>
                </button>
              </div>

              {mounted && (
                <div style={{ marginTop: 14 }}>
                  <EndpointConfig />
                </div>
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
