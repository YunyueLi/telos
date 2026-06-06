"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Icon } from "@/components/icon";
import { asset } from "@/lib/base";
import { DEMO_GRAPH as G } from "@/lib/graph";
import { useLearner } from "@/lib/telos/store";

const ACHIEVEMENTS = [
  { face: "cheer", title: "首次倒推", sub: "说出目标，生成第一张地图" },
  { face: "spark", title: "首个知识点掌握", sub: "Python 基础 · 测试通过" },
  { face: "flag", title: "连续 7 天", sub: "差 1 天 · 进行中" },
] as const;

const SETTINGS = [
  { icon: "flag", label: "学习目标", val: "FastAPI · JWT 鉴权 API" },
  { icon: "clock", label: "每日提醒", val: "20:00" },
  { icon: "gauge", label: "外观", val: "纸张 · 浅色" },
] as const;

const GROUPS = [
  { key: "done", title: "已掌握", cls: "done" },
  { key: "now", title: "现在学", cls: "now" },
  { key: "learn", title: "学习中", cls: "learn" },
  { key: "lock", title: "未解锁", cls: "lock" },
] as const;

export default function ProfilePage() {
  const L = useLearner();
  const stats = [
    { num: `${L.mastered}/${L.total}`, lab: "已掌握" },
    { num: "6", lab: "连续天数" },
    { num: "14", lab: "学习时长 (h)" },
    { num: "23", lab: "通过测试" },
  ];

  return (
    <>
      <SiteHeader />
      <div className="wrap">
        <section>
          <div className="shead">
            <span className="no">04</span>
            <h2>个人中心</h2>
            <span className="sub">你的进度、成就与设置</span>
          </div>
          <div className="cap">
            <span>档案</span>
            <span>telos.app/profile</span>
          </div>

          <div className="plate">
            <div className="ptop">
              <span className="u">telos.app/profile</span>
              <span className="br">
                <i />
                <i />
                <i />
              </span>
            </div>

            <div className="phead">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="pcirc pavatar">
                <img src={asset("/portraits/reading.png")} alt="Alex" />
              </span>
              <div className="pinfo">
                <div className="eye mono">Telos 学员 · 自 2026</div>
                <h2>Alex</h2>
                <p className="pgoal">
                  目标：{G.goal} · 倒推出 {L.total} 个知识点
                </p>
                <div className="ptags">
                  <span className="chip">
                    <Icon name="spark" /> 连续 6 天
                  </span>
                  <span className="chip">
                    <Icon name="target" /> 进度 {L.mastered}/{L.total}
                  </span>
                </div>
              </div>
              <Link className="btn btn-line pedit" href="/diagnose">
                <Icon name="refresh" /> 重新测评
              </Link>
            </div>

            <div className="pstats">
              {stats.map((s) => (
                <div key={s.lab} className="pstat">
                  <span className="num">{s.num}</span>
                  <span className="lab mono">{s.lab}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="psplit">
            <div>
              <div className="psh">
                <h3 className="mono">掌握进度</h3>
                <Link className="psmore mono" href="/map">
                  在地图查看 <Icon name="arrow" />
                </Link>
              </div>
              {GROUPS.map((grp) => {
                const items = G.nodes.filter((n) => L.visual[n.id] === grp.key);
                if (items.length === 0) return null;
                return (
                  <div key={grp.key} className="pgrp">
                    <div className="pglab mono">
                      <span className={`stt ${grp.cls}`} />
                      {grp.title}
                      <span className="pgc">{items.length}</span>
                    </div>
                    <div className="pnodes">
                      {items.map((n) => (
                        <div key={n.id} className={`n ${L.visual[n.id]}`}>
                          {n.label}
                          <s>{L.sub[n.id]}</s>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pside">
              <div className="psh">
                <h3 className="mono">成就</h3>
              </div>
              <div className="pach">
                {ACHIEVEMENTS.map((a) => (
                  <div key={a.title} className="par">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <span className="pmini">
                      <img src={asset(`/portraits/${a.face}.png`)} alt="" />
                    </span>
                    <div className="parc">
                      <b>{a.title}</b>
                      <span className="mono">{a.sub}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="psh" style={{ marginTop: 26 }}>
                <h3 className="mono">设置</h3>
              </div>
              <div className="pset">
                {SETTINGS.map((s) => (
                  <button key={s.label} className="psr">
                    <span className="psri">
                      <Icon name={s.icon} />
                    </span>
                    <span className="psrl">{s.label}</span>
                    <span className="psrv mono">{s.val}</span>
                    <span className="psra">
                      <Icon name="arrow" />
                    </span>
                  </button>
                ))}
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
