"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import * as acct from "@/lib/telos/account";
import {
  captureTokenFromHash,
  cloudConfigured,
  cloudPull,
  cloudPush,
  cloudSendMagicLink,
  cloudToken,
  setCloudToken,
} from "@/lib/telos/cloud";
import { load, save } from "@/lib/telos/store";
import type { LearnerState } from "@/lib/telos/engine";

export default function AccountPage() {
  const [profiles, setProfiles] = useState<acct.Profile[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [newName, setNewName] = useState("");
  const [backup, setBackup] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const configured = cloudConfigured();

  function refresh() {
    setProfiles(acct.listProfiles());
    setCurrentId(acct.currentProfile().id);
  }
  useEffect(() => {
    captureTokenFromHash();
    setSignedIn(!!cloudToken());
    refresh();
  }, []);

  const create = () => {
    if (!newName.trim()) return;
    acct.createProfile(newName);
    setNewName("");
    refresh();
    setMsg("已创建并切换到新档案");
  };
  const rename = (id: string) => {
    const cur = profiles.find((p) => p.id === id)?.name;
    const n = window.prompt("重命名档案", cur);
    if (n) {
      acct.renameProfile(id, n);
      refresh();
    }
  };
  const remove = (id: string) => {
    if (window.confirm("删除该档案及其学习状态？此操作不可撤销。")) {
      acct.deleteProfile(id);
      refresh();
      setMsg("已删除档案");
    }
  };
  const doExport = () => {
    setBackup(acct.exportProfile(currentId));
    setMsg("已生成备份码——复制保存即可");
  };
  const doImport = () => {
    try {
      acct.importProfile(backup);
      refresh();
      setBackup("");
      setMsg("已导入为新档案");
    } catch {
      setMsg("备份码无效");
    }
  };

  const sendLink = async () => {
    const r = await cloudSendMagicLink(email);
    setMsg(r.ok ? "登录链接已发送，去邮箱点击后会自动回到本页" : `发送失败：${r.error}`);
  };
  const push = async () => {
    const st = load();
    const r = await cloudPush(currentId, st);
    setMsg(r.ok ? "当前档案已上传到云端" : `上传失败：${r.error}`);
  };
  const pull = async () => {
    const r = await cloudPull(currentId);
    if (r.ok && r.state) {
      save(r.state as LearnerState);
      setMsg("已从云端恢复——刷新或重进页面查看");
    } else {
      setMsg(`恢复失败：${r.error ?? "云端暂无数据"}`);
    }
  };
  const signOut = () => {
    setCloudToken(null);
    setSignedIn(false);
    setMsg("已退出云端");
  };

  return (
    <>
      <SiteHeader />
      <div className="wrap">
        <section>
          <div className="shead">
            <span className="no">06</span>
            <h2>账号</h2>
            <span className="sub">档案 · 备份 · 云同步</span>
          </div>

          <div className="plate" style={{ padding: 28 }}>
            <div style={{ display: "flex", gap: 18, alignItems: "center", marginBottom: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="pcirc" style={{ width: 64, height: 64, flex: "none" }}>
                <img src={asset("/portraits/reading.png")} alt="" />
              </span>
              <div>
                <div className="eye mono">本地优先 · 数据存在你的浏览器</div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 500 }}>
                  学习档案
                </div>
              </div>
            </div>
            {msg && (
              <div
                className="mono"
                style={{ fontSize: 12, color: "var(--ink-2)", borderTop: "1px dashed var(--line-soft)", paddingTop: 12, marginTop: 8 }}
              >
                {msg}
              </div>
            )}
          </div>

          <div className="psplit">
            {/* profiles */}
            <div>
              <div className="psh">
                <h3 className="mono">档案</h3>
                <span className="psmore mono">{profiles.length} 个</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {profiles.map((p) => {
                  const isCurrent = p.id === currentId;
                  return (
                    <div
                      key={p.id}
                      className="plate"
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}
                    >
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: isCurrent ? "var(--ink)" : "transparent", border: "1.4px solid var(--ink)", flex: "none" }} />
                      <b style={{ fontWeight: 600 }}>{p.name}</b>
                      {isCurrent && <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>当前</span>}
                      <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                        {!isCurrent && (
                          <button className="chip" onClick={() => { acct.switchProfile(p.id); refresh(); setMsg("已切换档案"); }}>
                            切换
                          </button>
                        )}
                        <button className="chip" onClick={() => rename(p.id)}>重命名</button>
                        {profiles.length > 1 && (
                          <button className="chip" onClick={() => remove(p.id)}>删除</button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="psh" style={{ marginTop: 24 }}>
                <h3 className="mono">新建档案</h3>
              </div>
              <div className="gbox" style={{ display: "flex", gap: 8, alignItems: "center", padding: 12 }}>
                <input
                  className="mono"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="档案名，如「工作号」"
                  style={{ flex: 1, border: 0, background: "transparent", outline: "none", fontSize: 14, color: "var(--ink)" }}
                />
                <button className="btn btn-ink" style={{ padding: "9px 16px" }} onClick={create}>
                  新建 <Icon name="plus" />
                </button>
              </div>
            </div>

            {/* backup + cloud */}
            <div className="pside">
              <div className="psh">
                <h3 className="mono">备份 · 导出 / 导入</h3>
              </div>
              <p className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)", lineHeight: 1.7, marginBottom: 10 }}>
                导出当前档案为一段「备份码」，换设备粘贴导入即可。无需联网。
              </p>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button className="btn btn-line" style={{ padding: "9px 14px" }} onClick={doExport}>
                  <Icon name="up" /> 导出当前
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
                rows={5}
                style={{ width: "100%", border: "1px solid var(--line-soft)", borderRadius: 12, background: "var(--paper)", padding: 12, fontSize: 11, color: "var(--ink-2)", resize: "vertical" }}
              />

              <div className="psh" style={{ marginTop: 26 }}>
                <h3 className="mono">云同步</h3>
              </div>
              {!configured ? (
                <div className="dark" style={{ padding: 18 }}>
                  <div className="mono" style={{ fontSize: 11, color: "rgba(240,238,233,.6)", textTransform: "uppercase", letterSpacing: ".06em" }}>
                    未配置
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.6, margin: "8px 0 12px", color: "rgba(240,238,233,.85)" }}>
                    接一个免费 Supabase 项目即可跨设备同步（约 2 分钟，全程你操作；我们不保存你的密钥）。
                  </p>
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
              ) : !signedIn ? (
                <div className="gbox" style={{ padding: 12 }}>
                  <input
                    className="mono"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="邮箱（登录链接）"
                    style={{ width: "100%", border: 0, background: "transparent", outline: "none", fontSize: 14, color: "var(--ink)", marginBottom: 10 }}
                  />
                  <button className="btn btn-ink" style={{ width: "100%", justifyContent: "center" }} onClick={sendLink}>
                    发送登录链接 <Icon name="arrow" />
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    <Icon name="check" /> 已登录云端
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-line" style={{ flex: 1, justifyContent: "center" }} onClick={push}>
                      <Icon name="up" /> 上传
                    </button>
                    <button className="btn btn-line" style={{ flex: 1, justifyContent: "center" }} onClick={pull}>
                      <Icon name="refresh" /> 恢复
                    </button>
                  </div>
                  <button className="chip" style={{ alignSelf: "flex-start" }} onClick={signOut}>
                    退出云端
                  </button>
                </div>
              )}
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
