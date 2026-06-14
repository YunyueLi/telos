// 完课证书（Pro 结果型权益）：项目全部能力点完成后可领取。
// canvas 直绘横版证书（黑白纸感 · 纸纹 · 花角边框 · 罗盘徽章 · 兹证明引导 · 环绕文字印章 · 编号 + 验真链接）。
// 编号由外部传入（稳定，登记与验真同一个）；下载 PNG 即社交传播素材。

function hashCode(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(7, "0");
}

export function certSerial(goal: string, seed: string): string {
  return `TL-${hashCode(`${goal}|${seed}`)}`;
}

// 沿圆弧排布文字（印章环绕文字）。
function arcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  r: number,
  font: string,
  color: string,
  topCenter = true,
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const step = (Math.PI * 1.55) / text.length; // 占约 280°，留底部缺口
  let a = topCenter ? -Math.PI / 2 - ((text.length - 1) * step) / 2 : -Math.PI / 2;
  for (const ch of text) {
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += step;
  }
  ctx.restore();
}

// 罗盘徽章（顶部锚点）：刻度环 + 双圈 + 南北菱形指针。
function compassBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, INK: string, INK3: string): void {
  ctx.strokeStyle = INK;
  // 24 刻度（8 长 16 短）
  for (let i = 0; i < 24; i++) {
    const a = (Math.PI * 2 * i) / 24;
    const long = i % 3 === 0;
    const r1 = long ? 50 : 54;
    const r2 = 58;
    ctx.lineWidth = long ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = INK3;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 29, 0, Math.PI * 2);
  ctx.stroke();
  // 指针：上实心 / 下空心
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 24);
  ctx.lineTo(cx + 9, cy);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 24);
  ctx.lineTo(cx - 9, cy);
  ctx.lineTo(cx, cy + 24);
  ctx.lineTo(cx + 9, cy);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

// 四角花饰（线性，比单刻线精致）。
function cornerOrnament(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, INK: string): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, y + 34 * dy);
  ctx.lineTo(x, y);
  ctx.lineTo(x + 34 * dx, y);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 8 * dx, y + 20 * dy);
  ctx.lineTo(x + 8 * dx, y + 8 * dy);
  ctx.lineTo(x + 20 * dx, y + 8 * dy);
  ctx.stroke();
  // 小菱形点缀
  ctx.fillStyle = INK;
  const mx = x + 30 * dx;
  const my = y + 30 * dy;
  ctx.beginPath();
  ctx.moveTo(mx, my - 3);
  ctx.lineTo(mx + 3, my);
  ctx.lineTo(mx, my + 3);
  ctx.lineTo(mx - 3, my);
  ctx.closePath();
  ctx.fill();
}

// 居中装饰分隔（细线 + 端点菱形 + 中心菱形）。
function dividerOrn(ctx: CanvasRenderingContext2D, cx: number, y: number, half: number, INK: string, LINE: string): void {
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - half, y);
  ctx.lineTo(cx + half, y);
  ctx.stroke();
  ctx.fillStyle = INK;
  for (const px of [cx - half, cx, cx + half]) {
    const s = px === cx ? 4.5 : 3;
    ctx.beginPath();
    ctx.moveTo(px, y - s);
    ctx.lineTo(px + s, y);
    ctx.lineTo(px, y + s);
    ctx.lineTo(px - s, y);
    ctx.closePath();
    ctx.fill();
  }
}

export function buildCertificate(opts: {
  name: string;
  goal: string;
  nodes: number;
  dateText: string;
  completedText: string;
  serialLabel: string;
  brandText: string;
  serial: string;
  verifyUrl?: string;
  attestText?: string; // "兹证明" 引导语
  dateLabel?: string; // "完成于"
  sealText?: string; // 印章环绕文字
}): HTMLCanvasElement {
  const W = 1600;
  const H = 1131;
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
  const cx = W / 2;
  const SERIF = 'Fraunces, Georgia, "Songti SC", serif';
  const SANS = 'Inter, -apple-system, "PingFang SC", sans-serif';
  const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", monospace';
  const sp = (n: number) => {
    // letter-spacing（现代浏览器 canvas 支持；不支持则忽略，不影响主体）
    try {
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${n}px`;
    } catch {
      /* ignore */
    }
  };

  // 纸底
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  // 微妙斜纹纸纹（极淡）
  ctx.save();
  ctx.globalAlpha = 0.025;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  for (let x = -H; x < W; x += 13) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H, H);
    ctx.stroke();
  }
  ctx.restore();

  // 边框：外粗 + 内细 + 点线装饰
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.6;
  ctx.strokeRect(48, 48, W - 96, H - 96);
  ctx.strokeStyle = INK3;
  ctx.lineWidth = 1;
  ctx.strokeRect(63, 63, W - 126, H - 126);
  ctx.save();
  ctx.setLineDash([1, 6]);
  ctx.strokeStyle = INK3;
  ctx.lineWidth = 1;
  ctx.strokeRect(77, 77, W - 154, H - 154);
  ctx.restore();
  // 四角花饰
  cornerOrnament(ctx, 92, 92, 1, 1, INK);
  cornerOrnament(ctx, W - 92, 92, -1, 1, INK);
  cornerOrnament(ctx, 92, H - 92, 1, -1, INK);
  cornerOrnament(ctx, W - 92, H - 92, -1, -1, INK);

  // 罗盘徽章
  compassBadge(ctx, cx, 176, INK, INK3);

  ctx.textAlign = "center";
  // 品牌字标
  ctx.fillStyle = INK;
  ctx.font = `600 42px ${SERIF}`;
  sp(6);
  ctx.fillText("TELOS", cx, 296);
  sp(0);
  // 标语
  ctx.fillStyle = INK3;
  ctx.font = `500 15px ${MONO}`;
  sp(2);
  ctx.fillText(opts.brandText, cx, 326);
  sp(0);

  // 分隔装饰
  dividerOrn(ctx, cx, 364, 210, INK, LINE);

  // 兹证明 引导
  ctx.fillStyle = INK3;
  ctx.font = `500 16px ${MONO}`;
  sp(8);
  ctx.fillText(opts.attestText || "兹 证 明", cx, 436);
  sp(0);

  // 学员名（衬线大字）
  ctx.fillStyle = INK;
  ctx.font = `500 92px ${SERIF}`;
  ctx.fillText(opts.name, cx, 548);
  // 姓名下装饰线（两段短线 + 中心菱形）
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(cx - 150, 590);
  ctx.lineTo(cx - 26, 590);
  ctx.moveTo(cx + 26, 590);
  ctx.lineTo(cx + 150, 590);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(cx, 585);
  ctx.lineTo(cx + 5, 590);
  ctx.lineTo(cx, 595);
  ctx.lineTo(cx - 5, 590);
  ctx.closePath();
  ctx.fill();

  // 完成说明
  ctx.fillStyle = INK2;
  ctx.font = `500 26px ${SANS}`;
  ctx.fillText(opts.completedText, cx, 648);
  // 目标（衬线强调，超长二分换行）
  ctx.fillStyle = INK;
  ctx.font = `500 46px ${SERIF}`;
  const goal = `「${opts.goal}」`;
  const maxW = W - 420;
  if (ctx.measureText(goal).width <= maxW) {
    ctx.fillText(goal, cx, 726);
  } else {
    let cut = Math.floor(goal.length / 2);
    while (cut < goal.length && ctx.measureText(goal.slice(0, cut)).width < maxW) cut++;
    while (cut > 0 && ctx.measureText(goal.slice(0, cut)).width > maxW) cut--;
    ctx.fillText(goal.slice(0, cut), cx, 708);
    ctx.fillText(goal.slice(cut), cx, 766);
  }

  // 中部到底部的装饰花线（填充留白节奏）
  dividerOrn(ctx, cx, 838, 150, INK, LINE);

  // ── 底部三栏：左 完成日期 / 中 印章 / 右 编号 ──
  const footY = H - 138;
  ctx.textAlign = "left";
  ctx.fillStyle = INK3;
  ctx.font = `500 13px ${MONO}`;
  sp(2);
  ctx.fillText((opts.dateLabel || "完成于").toUpperCase(), 150, footY - 20);
  sp(0);
  ctx.fillStyle = INK2;
  ctx.font = `500 22px ${SERIF}`;
  ctx.fillText(opts.dateText, 150, footY + 10);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(150, footY + 28);
  ctx.lineTo(360, footY + 28);
  ctx.stroke();

  ctx.textAlign = "right";
  ctx.fillStyle = INK3;
  ctx.font = `500 13px ${MONO}`;
  sp(2);
  ctx.fillText(opts.serialLabel.toUpperCase(), W - 150, footY - 20);
  sp(0);
  ctx.fillStyle = INK2;
  ctx.font = `600 22px ${MONO}`;
  ctx.fillText(opts.serial, W - 150, footY + 10);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W - 360, footY + 28);
  ctx.lineTo(W - 150, footY + 28);
  ctx.stroke();

  // 印章（环绕文字 + 双环 + 中心小罗盘）
  const sy = footY - 2;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, sy, 56, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, sy, 47, 0, Math.PI * 2);
  ctx.stroke();
  arcText(ctx, opts.sealText || "TELOS · 完课认证 · CERTIFIED", cx, sy, 51, `600 11px ${MONO}`, INK);
  // 中心小罗盘
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(cx, sy - 16);
  ctx.lineTo(cx + 7, sy);
  ctx.lineTo(cx, sy + 16);
  ctx.lineTo(cx - 7, sy);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, sy, 22, 0, Math.PI * 2);
  ctx.stroke();

  // 验真链接（社交传播：凭编号在此页核验真伪）
  if (opts.verifyUrl) {
    ctx.textAlign = "center";
    ctx.fillStyle = INK3;
    ctx.font = `500 14px ${MONO}`;
    ctx.fillText(opts.verifyUrl, cx, H - 58);
  }

  return canvas;
}
