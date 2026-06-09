"use client";

// 分级文本可视化：把「新手：…；进阶：…；精英：…」这类分级达标线拆成独立行（标签 + 内容）。
// 语言无关：按 ；/;/。 或英文「. 」切分（不切小数 90.5%），识别「标签：内容」（半/全角冒号）。
// 至少 2 段带标签才认定为分级，否则回退纯文本。
import styles from "./app.module.css";

interface Tier {
  label: string;
  body: string;
}

function parseTiers(text: string): Tier[] | null {
  const t = (text || "").trim();
  if (!t) return null;
  const parts = t
    .split(/[；;。]+|\.\s+/)
    .map((s) => s.trim().replace(/[。.，,、]+$/, "").trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  // 识别「标签：内容」（半/全角冒号）。无标签的句子并入前一个带标签段落的正文——
  // 它们是该段的延续，不该单独成一行没有 chip 的孤行（那正是换行显得很怪的原因）。
  const rows: Tier[] = [];
  for (const p of parts) {
    const m = p.match(/^([^：:]{1,14})[：:]\s*([\s\S]+)$/);
    if (m) rows.push({ label: m[1].trim(), body: m[2].trim() });
    else if (rows.length && rows[rows.length - 1].label) rows[rows.length - 1].body += "。" + p;
    else rows.push({ label: "", body: p });
  }
  // 至少 2 段带标签才认定为分级（避免把普通分句误拆）
  if (rows.filter((r) => r.label).length < 2) return null;
  return rows;
}

export function TierText({ text, className }: { text: string; className?: string }) {
  const tiers = parseTiers(text);
  if (!tiers) return <div className={className}>{text}</div>;
  return (
    <div className={styles.tierList}>
      {tiers.map((r, i) => (
        <div key={i} className={styles.tierRow}>
          {r.label && <span className={styles.tierLabel}>{r.label}</span>}
          <span className={styles.tierBody}>{r.body}</span>
        </div>
      ))}
    </div>
  );
}
