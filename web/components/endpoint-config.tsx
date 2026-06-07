"use client";

// 端点配置（#10 简化）：对标 LibreChat/Lobe/Jan —— 预设一键填 + 单字段 + 「测试连接」即时 ✓/✗ + 保存。
// 本架构 key 在服务端，前端只选端点；localhost 已零配置默认指向本地 serve.py。onboarding 与「我」共用本组件。
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { getDeriveUrl, setDeriveUrl, testEndpoint, LOCAL_ENDPOINT, type EndpointStatus } from "@/lib/telos/derive";
import { useT } from "@/lib/telos/i18n";

const PRESETS = [
  { key: "local", labelKey: "epc.local", fill: LOCAL_ENDPOINT },
  { key: "worker", labelKey: "epc.worker", fill: "https://你的子域.workers.dev/derive" },
];

export function EndpointConfig({ onSaved }: { onSaved?: (url: string) => void }) {
  const { t } = useT();
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState("");
  const [status, setStatus] = useState<EndpointStatus | null>(null);
  const [testing, setTesting] = useState(false);

  async function runTest(u: string) {
    setTesting(true);
    setStatus(null);
    setStatus(await testEndpoint(u));
    setTesting(false);
  }

  useEffect(() => {
    const u = getDeriveUrl();
    setDraft(u);
    setSaved(u);
    if (u) void runTest(u); // 进来先自动测一次当前端点，给即时反馈
  }, []);

  function save() {
    const v = draft.trim();
    setDeriveUrl(v);
    setSaved(v);
    onSaved?.(v);
    if (v) void runTest(v);
  }

  const trimmed = draft.trim();
  const isPreset = PRESETS.some((p) => p.fill === trimmed);
  const active = PRESETS.find((p) => p.fill === trimmed)?.key ?? (trimmed ? "custom" : "");

  return (
    <div className="epc">
      <div className="epc-chips">
        {PRESETS.map((p) => (
          <button key={p.key} className={`epc-chip ${active === p.key ? "on" : ""}`} onClick={() => setDraft(p.fill)}>
            {t(p.labelKey)}
          </button>
        ))}
        <button
          className={`epc-chip ${active === "custom" ? "on" : ""}`}
          onClick={() => {
            if (isPreset) setDraft("");
          }}
        >
          {t("epc.custom")}
        </button>
      </div>

      <div className="epc-row">
        <input
          placeholder={LOCAL_ENDPOINT}
          value={draft}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
        <button className="btn btn-line epc-btn" onClick={() => runTest(draft)} disabled={testing || !trimmed}>
          {testing ? t("epc.testing") : t("epc.test")}
        </button>
        <button className="btn btn-ink epc-btn" onClick={save} disabled={trimmed === saved.trim()}>
          {t("epc.save")}
        </button>
      </div>

      {status && (
        <div className={`epc-status ${status.ok ? "ok" : "bad"}`}>
          {status.ok ? (
            <>
              <span className="dot dot-ok" /> {t("epc.connected")}
              {status.model ? t("epc.model", { model: status.model }) : ""}
              {status.available === false ? t("epc.keyMissing") : t("epc.keyReady")}
            </>
          ) : (
            <>
              <span className="dot dot-off" /> {status.error}
            </>
          )}
        </div>
      )}

      <div className="epc-note">
        <Icon name="lock" style={{ width: 12, height: 12, verticalAlign: -2, marginRight: 5 }} />
        {t("epc.note")}
      </div>
    </div>
  );
}
