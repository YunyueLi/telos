// 完课证书（Pro 结果型权益）：项目全部能力点完成后可领取。
// canvas 直绘横版证书（黑白纸感 · 双线图廓 · 罗盘 mark · 衬线标题 · 编号），下载 PNG 即社交传播素材。
// 编号 = 内容哈希（目标+完成日），同一完成事实编号稳定；真验真（服务端登记）后续接 Supabase。

function hashCode(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(7, "0");
}

export function certSerial(goal: string, dateISO: string): string {
  return `TL-${hashCode(`${goal}|${dateISO}`)}`;
}

export function buildCertificate(opts: {
  name: string; // 学员名（空 → 调用方传"Telos 学员"）
  goal: string; // 项目目标/标题
  nodes: number;
  dateText: string; // 本地化日期
  completedText: string; // "已完成全部 N 个能力点"
  serialLabel: string; // "编号"
  brandText: string; // 标语
}): HTMLCanvasElement {
  const W = 1600;
  const H = 1131; // ≈ A4 横版比例
  const S = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(S, S);

  const INK = "#141310";
  const INK2 = "#56524A";
  const INK3 = "#928E84";
  const PAPER = "#F7F5F0";
  const LINE = "#E2DFD7";

  // 纸底
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  // 双线图廓（外粗内细，经典证书边框）
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(44, 44, W - 88, H - 88);
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK3;
  ctx.strokeRect(58, 58, W - 116, H - 116);
  // 四角装饰刻线
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  for (const [cx, cy, dx, dy] of [
    [82, 82, 1, 1],
    [W - 82, 82, -1, 1],
    [82, H - 82, 1, -1],
    [W - 82, H - 82, -1, -1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + 26 * dy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + 26 * dx, cy);
    ctx.stroke();
  }

  const cx = W / 2;
  // 罗盘 mark（顶部居中）
  const my = 188;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, my, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([2, 7]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, my, 46, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(cx, my - 23);
  ctx.lineTo(cx + 11, my);
  ctx.lineTo(cx, my + 23);
  ctx.lineTo(cx - 11, my);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = "center";
  // 品牌字标
  ctx.fillStyle = INK;
  ctx.font = '600 44px Fraunces, Georgia, "Songti SC", serif';
  ctx.fillText("Telos", cx, my + 110);
  // 标语
  ctx.fillStyle = INK3;
  ctx.font = '500 17px ui-monospace, "SF Mono", monospace';
  ctx.fillText(opts.brandText, cx, my + 144);
  // 分隔细线
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 240, my + 178);
  ctx.lineTo(cx + 240, my + 178);
  ctx.stroke();

  // 学员名（衬线大字）
  ctx.fillStyle = INK;
  ctx.font = '500 88px Fraunces, Georgia, "Songti SC", serif';
  ctx.fillText(opts.name, cx, 520);
  // 完成说明
  ctx.fillStyle = INK2;
  ctx.font = '500 26px Inter, -apple-system, "PingFang SC", sans-serif';
  ctx.fillText(opts.completedText, cx, 588);
  // 目标（衬线强调，超长换行）
  ctx.fillStyle = INK;
  ctx.font = '500 46px Fraunces, Georgia, "Songti SC", serif';
  const goal = `「${opts.goal}」`;
  const maxW = W - 360;
  if (ctx.measureText(goal).width <= maxW) {
    ctx.fillText(goal, cx, 678);
  } else {
    // 简单二分换两行
    let cut = Math.floor(goal.length / 2);
    while (cut < goal.length && ctx.measureText(goal.slice(0, cut)).width < maxW) cut++;
    while (cut > 0 && ctx.measureText(goal.slice(0, cut)).width > maxW) cut--;
    ctx.fillText(goal.slice(0, cut), cx, 660);
    ctx.fillText(goal.slice(cut), cx, 722);
  }

  // 底部：日期（左）· 编号（右）
  ctx.textAlign = "left";
  ctx.fillStyle = INK2;
  ctx.font = '500 20px ui-monospace, "SF Mono", monospace';
  ctx.fillText(opts.dateText, 120, H - 130);
  ctx.textAlign = "right";
  ctx.fillText(`${opts.serialLabel} ${certSerial(opts.goal, opts.dateText)}`, W - 120, H - 130);
  // 底部中线印章感圆环
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  ctx.arc(cx, H - 150, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = '600 15px ui-monospace, "SF Mono", monospace';
  ctx.fillText("TELOS", cx, H - 156);
  ctx.font = '500 11px ui-monospace, "SF Mono", monospace';
  ctx.fillText("VERIFIED", cx, H - 138);

  return canvas;
}
