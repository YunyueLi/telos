// 导出 Anki 卡组（官方文本导入格式，Anki 2.1.55+ 文件头）：
// 每个能力点一张卡 —— 正面 = 能力名（can-do），背面 = 描述 + 怎么练 + 达标线，
// 标签 = telos + 阶段名。Anki「文件导入」直接识别分隔符/HTML/标签列，配合 FSRS（Anki 内置）继续排程。
// Pro 专属（结果型权益）。
import { KnowledgeGraph } from "./engine";

const esc = (s: string) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, "<br>");

const tagify = (s: string) => String(s || "").trim().replace(/\s+/g, "_").replace(/"/g, "");

export function buildAnkiTsv(
  g: KnowledgeGraph,
  labels: { how: string; benchmark: string; stage: string },
): string {
  const lines: string[] = ["#separator:tab", "#html:true", "#tags column:3", "#columns:Front\tBack\tTags"];
  for (const id of g.ids()) {
    const kp = g.get(id);
    const back: string[] = [];
    if (kp.desc && kp.desc.trim()) back.push(esc(kp.desc));
    if (kp.drill && kp.drill.trim()) back.push(`<b>${esc(labels.how)}</b><br>${esc(kp.drill)}`);
    if (kp.benchmark && kp.benchmark.trim()) back.push(`<b>${esc(labels.benchmark)}</b><br>${esc(kp.benchmark)}`);
    if (kp.moduleTitle) back.push(`<i>${esc(labels.stage)} · ${esc(kp.moduleTitle)}</i>`);
    const tags = ["telos", kp.moduleTitle ? tagify(kp.moduleTitle) : ""].filter(Boolean).join(" ");
    lines.push(`${esc(kp.name)}\t${back.join("<br><br>") || esc(kp.name)}\t${tags}`);
  }
  return lines.join("\n");
}
