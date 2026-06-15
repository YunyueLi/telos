# Telos 出图 Prompt 母版

> 工具：**GPT img-2（gpt-image-1）**。每条 prompt **独立完整、复制即用，无需拼接**。
> 建议同组在一个会话里连续生成，风格最连贯。

## 生成进度（你已生成 16 张 · 2026-06-15）

✅ **已生成**——看板娘需 hero 的几组都齐了，还额外做了神态与里程碑：

| 组 | 你的文件 | 状态 |
|---|---|---|
| 画风 | `泼墨写意 · theme-xieyi` · `木刻版画 · theme-woodcut` | ✅ 2 |
| 季节 | `spring` · `summer` · `autumn` · `winter` | ✅ 4 |
| 场景 | `scene-nightread` · `scene-lectern` · `scene-shelves` · `scene-annotate` · `scene-summit` | ✅ 5 |
| 日常神态（额外，归 daily 系列） | `ponder` · `applaud` · `nod` · `lantern` | ✅ 4 |
| 里程碑（额外，归 milestone 系列） | `zongshi`（宗师） | ✅ 1 |

⬜ **还没生成**（这两组是静物、**不需** hero）：
- 文房清玩 8 张（下方第四组）
- 印章 9 张（下方第五组）

➕ **可补充 / 我接代码时会对齐**：
- 命名以你的为准，我接代码时统一成 ASCII（如 `泼墨写意 · theme-xieyi.png` → `face-xieyi.png`，`scene-lectern.png` 去掉前导空格），不用你改。
- 我原列的场景「临窗 / 茶歇 / 漫思」你用 lectern / shelves / annotate / summit 替代了，已经够；想要更多场景随时加。
- `ponder / applaud / nod / lantern` 4 张神态 + `zongshi` 是额外做的，很好——我会注册进形象集对应系列，照旧绑真实学习里程碑解锁。

---

## 是否需要上传 hero.png？

| 组 | 数量 | 上传 hero.png？ | 落地位置 | 用途 |
|---|---|---|---|---|
| 一、看板娘 · 画风 | 2 | **是** | `web/public/portraits/` | Pro 画风主题立绘（theme face） |
| 二、看板娘 · 场景 | 5 | **是** | `web/public/portraits/` | 形象集「场景」系列 |
| 三、看板娘 · 季节 | 4 | **是** | `web/public/portraits/` | 形象集「季节」系列 |
| 四、文房清玩 | 8 | 否 | `web/public/decor/` | 书斋装点 |
| 五、印章 | 9 | 否（可选；现有 SVG 亦可用） | `web/public/seals/` | 印章雅号·朱红篆刻 |

> **hero.png** = 看板娘主形象（年轻女老师，黑白墨线）。看板娘所有系列都要把它作为**参考图上传**，保证是同一个她。文房/印章是静物，无需参考。
> 生成后按每条下方的**文件名**保存，丢进对应目录，我接代码（注册 / 替换 SVG / 放大展示）。

---

## 一、看板娘 · 画风系列 〔需上传 hero.png〕

同一个她，换一种绘画语言（绑 Pro 画风主题）。**只保留两种：泼墨写意、木刻**。

**1 — 泼墨写意 → `face-ink.png`**
```
Using the uploaded reference image (hero.png) to keep the SAME young female teacher clearly recognizable — same face shape, hairstyle, and glasses — re-imagine her half-body portrait in bold traditional Chinese xieyi splashed-ink (泼墨写意) style. Expressive wet brushwork with a rich range of ink tones from saturated black to soft gray washes, natural dry-brush "flying-white" streaks, real ink weight and spontaneity — NOT thin even outlines, NOT delicate gongbi linework. Pure black ink on a fully transparent background, no color. Calm scholarly mood, centered, square 1:1, high resolution.
```

**2 — 木刻版画 → `face-cut.png`**
```
Using the uploaded reference image (hero.png) to keep the SAME young female teacher clearly recognizable — same face shape, hairstyle, and glasses — re-imagine her half-body portrait as a black-and-white woodcut / woodblock print (木刻版画). Bold high-contrast carved linework, strong angular gouge marks, dramatic black-and-white masses with hand-printed grain texture, weighty and graphic. Pure black ink on a fully transparent background, no color, no gray gradients. Calm scholarly mood, centered, square 1:1, high resolution.
```

---

## 二、看板娘 · 场景系列 〔需上传 hero.png〕

保持 hero 的画风与人物**完全一致**，只换场景/姿态。半身或胸像构图。

**1 — 伏案 → `scene-desk.png`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide: a black-and-white hand-drawn ink-line illustration of the SAME young female teacher — keep her face, hairstyle, glasses, line style and gentle scholarly demeanor identical to the reference. She sits at a wooden desk writing with a calligraphy brush, head slightly lowered in quiet focus. Clean confident ink linework, warm calm mood, transparent background, no color. Half-body framing, centered, square 1:1, high resolution.
```

**2 — 临窗 → `scene-window.png`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide: a black-and-white hand-drawn ink-line illustration of the SAME young female teacher — keep her face, hairstyle, glasses, line style and gentle scholarly demeanor identical to the reference. She stands by a lattice window reading an open book, soft daylight falling from the side. Clean confident ink linework, warm calm mood, transparent background, no color. Half-body framing, centered, square 1:1, high resolution.
```

**3 — 茶歇 → `scene-tea.png`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide: a black-and-white hand-drawn ink-line illustration of the SAME young female teacher — keep her face, hairstyle, glasses, line style and gentle scholarly demeanor identical to the reference. She pauses holding a small teacup with both hands, eyes gently lowered with a calm half-smile, taking a quiet break. Clean confident ink linework, warm calm mood, transparent background, no color. Half-body framing, centered, square 1:1, high resolution.
```

**4 — 夜读 → `scene-night.png`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide: a black-and-white hand-drawn ink-line illustration of the SAME young female teacher — keep her face, hairstyle, glasses, line style and gentle scholarly demeanor identical to the reference. She reads by the glow of a single candle at night, an intimate focused atmosphere, soft shadows suggested with light ink hatching. Clean confident ink linework, transparent background, no color. Half-body framing, centered, square 1:1, high resolution.
```

**5 — 漫思 → `scene-stroll.png`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide: a black-and-white hand-drawn ink-line illustration of the SAME young female teacher — keep her face, hairstyle, glasses, line style and gentle scholarly demeanor identical to the reference. She walks slowly holding a closed book to her chest, one hand resting thoughtfully near her chin, a contemplative expression. Clean confident ink linework, warm calm mood, transparent background, no color. Half-body framing, centered, square 1:1, high resolution.
```

---

## 三、看板娘 · 季节系列 〔需上传 hero.png〕

四季的她，画风与人物保持与 hero 一致，环境点缀对应时令（黑白，不上色）。

**1 — 春 → `season-spring.png`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide: a black-and-white hand-drawn ink-line illustration of the SAME young female teacher — keep her face, hairstyle, glasses, line style and gentle scholarly demeanor identical to the reference. Spring: a few blossom petals drift around her as she looks up with a soft hopeful expression. Clean confident ink linework, transparent background, no color (black ink only). Half-body framing, centered, square 1:1, high resolution.
```

**2 — 夏 → `season-summer.png`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide: a black-and-white hand-drawn ink-line illustration of the SAME young female teacher — keep her face, hairstyle, glasses, line style and gentle scholarly demeanor identical to the reference. Summer: she holds a round silk fan near a few bamboo leaves, a light breeze lifting her hair, a cool composed expression. Clean confident ink linework, transparent background, no color (black ink only). Half-body framing, centered, square 1:1, high resolution.
```

**3 — 秋 → `season-autumn.png`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide: a black-and-white hand-drawn ink-line illustration of the SAME young female teacher — keep her face, hairstyle, glasses, line style and gentle scholarly demeanor identical to the reference. Autumn: a few maple leaves drift down around her, a serene contemplative expression. Clean confident ink linework, transparent background, no color (black ink only). Half-body framing, centered, square 1:1, high resolution.
```

**4 — 冬 → `season-winter.png`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide: a black-and-white hand-drawn ink-line illustration of the SAME young female teacher — keep her face, hairstyle, glasses, line style and gentle scholarly demeanor identical to the reference. Winter: she wears a thicker wrapped robe with a few snowflakes around her and a warm gentle smile. Clean confident ink linework, transparent background, no color (black ink only). Half-body framing, centered, square 1:1, high resolution.
```

---

## 四、文房清玩 〔无需参考〕

写意墨绘单体静物，纯黑白（朱红留给印章），透明背景，1:1。书斋装点用。

**1 — 笔筒 → `d-bitong.png`**
```
A traditional Chinese xieyi (写意) freehand ink-wash painting of a single cylindrical brush pot holding four calligraphy brushes of varying heights, their pointed tips fanning upward. A scholar's-desk still life in pure black ink, isolated on a fully transparent background (PNG with alpha) — no color, no red, no scenery, no shadow, no frame. Bold expressive sumi-e brushwork with a rich tonal range from saturated deep black to soft gray washes, visible bristle and brush texture, and natural dry-brush "flying-white" streaks, conveying real ink weight and effortless spontaneity — NOT thin uniform outlines, NOT fine gongbi linework, NOT a flat vector icon. Subject centered, filling about 70% of the frame with generous empty margin on all sides. Square 1:1, high resolution, cleanly isolated for compositing.
```

**2 — 镇纸 → `d-zhenzhi.png`**
```
A traditional Chinese xieyi (写意) freehand ink-wash painting of a single elongated rectangular scholar's paperweight (镇纸) lying flat, with a small carved knob or a couple of faint engraved characters on its top face. Pure black ink, isolated on a fully transparent background (PNG with alpha) — no color, no red, no scenery, no shadow, no frame. Bold expressive sumi-e brushwork with a rich tonal range from saturated deep black to soft gray washes, visible brush texture and natural dry-brush "flying-white" streaks, conveying ink weight and spontaneity — NOT thin uniform outlines, NOT fine gongbi linework, NOT a flat vector icon. Subject centered, filling about 70% of the frame with generous empty margin all around. Square 1:1, high resolution, cleanly isolated for compositing.
```

**3 — 书卷 → `d-juan.png`**
```
A traditional Chinese xieyi (写意) freehand ink-wash painting of a single partially unrolled hand-scroll resting on its side, one end loosely curled open to hint at calligraphy within, the wooden roller suggested at one end. Pure black ink, isolated on a fully transparent background (PNG with alpha) — no color, no red, no scenery, no shadow, no frame. Bold expressive sumi-e brushwork with a rich tonal range from saturated deep black to soft gray washes, visible brush texture and natural dry-brush "flying-white" streaks, conveying ink weight and spontaneity — NOT thin uniform outlines, NOT fine gongbi linework, NOT a flat vector icon. Subject centered, filling about 70% of the frame with generous empty margin all around. Square 1:1, high resolution, cleanly isolated for compositing.
```

**4 — 盆景 → `d-penjing.png`**
```
A traditional Chinese xieyi (写意) freehand ink-wash painting of a single miniature gnarled pine bonsai (盆景) growing from a shallow rectangular tray pot, with a few wind-bent branches and sparse tufts of needles. Pure black ink, isolated on a fully transparent background (PNG with alpha) — no color, no red, no scenery, no shadow, no frame. Bold expressive sumi-e brushwork with a rich tonal range from saturated deep black to soft gray washes, visible brush texture and natural dry-brush "flying-white" streaks, conveying ink weight and spontaneity — NOT thin uniform outlines, NOT fine gongbi linework, NOT a flat vector icon. Subject centered, filling about 70% of the frame with generous empty margin all around. Square 1:1, high resolution, cleanly isolated for compositing.
```

**5 — 香炉 → `d-xianglu.png`**
```
A traditional Chinese xieyi (写意) freehand ink-wash painting of a single small tripod incense burner (香炉, ding form) with two side handles and three short legs, a single thin wisp of smoke curling gently upward from it. Pure black ink, isolated on a fully transparent background (PNG with alpha) — no color, no red, no scenery, no shadow, no frame. Bold expressive sumi-e brushwork with a rich tonal range from saturated deep black to soft gray washes, visible brush texture and natural dry-brush "flying-white" streaks, conveying ink weight and spontaneity — NOT thin uniform outlines, NOT fine gongbi linework, NOT a flat vector icon. Subject centered, filling about 70% of the frame with generous empty margin all around. Square 1:1, high resolution, cleanly isolated for compositing.
```

**6 — 茶具 → `d-chaju.png`**
```
A traditional Chinese xieyi (写意) freehand ink-wash painting of a small round teapot with a curved spout and loop handle, accompanied by one small tea cup beside it. Pure black ink, isolated on a fully transparent background (PNG with alpha) — no color, no red, no scenery, no shadow, no frame. Bold expressive sumi-e brushwork with a rich tonal range from saturated deep black to soft gray washes, visible brush texture and natural dry-brush "flying-white" streaks, conveying ink weight and spontaneity — NOT thin uniform outlines, NOT fine gongbi linework, NOT a flat vector icon. Subjects grouped and centered, filling about 70% of the frame with generous empty margin all around. Square 1:1, high resolution, cleanly isolated for compositing.
```

**7 — 古琴 → `d-guqin.png`**
```
A traditional Chinese xieyi (写意) freehand ink-wash painting of a single guqin (古琴), the ancient seven-string Chinese zither, lying horizontally in side profile, its long slender gently-curved body and taut strings rendered with a few sure confident strokes. Pure black ink, isolated on a fully transparent background (PNG with alpha) — no color, no red, no scenery, no shadow, no frame. Bold expressive sumi-e brushwork with a rich tonal range from saturated deep black to soft gray washes, visible brush texture and natural dry-brush "flying-white" streaks, conveying ink weight and spontaneity — NOT thin uniform outlines, NOT fine gongbi linework, NOT a flat vector icon. Subject centered, filling about 70% of the frame with generous empty margin all around. Square 1:1, high resolution, cleanly isolated for compositing.
```

**8 — 山水挂画 → `d-shanshui.png`**
```
A traditional Chinese xieyi (写意) freehand ink-wash painting of a hanging scroll (山水挂画) mounted with slender top and bottom rods, the scroll itself depicting a distant mountain landscape — a few misty peaks above a stretch of still water. Pure black ink, isolated on a fully transparent background (PNG with alpha) — no color, no red, no surrounding scenery, no shadow, no outer frame. Bold expressive sumi-e brushwork with a rich tonal range from saturated deep black to soft gray washes, visible brush texture and natural dry-brush "flying-white" streaks, conveying ink weight and spontaneity — NOT thin uniform outlines, NOT fine gongbi linework, NOT a flat vector icon. Subject centered, filling about 70% of the frame with generous empty margin all around. Square 1:1, high resolution, cleanly isolated for compositing.
```

---

## 五、印章 〔无需参考；可选〕

朱红篆刻拓印质感（**唯一保留彩色：朱砂红**，与黑白文房区分开）。目前代码里是 SVG 矢量印、可直接用；若想换成手刻拓印质感，用下面这套。图形意象与现有 9 枚一一对应。

**1 — 启程 → `s-qicheng.png`**
```
A traditional Chinese carved seal impression (篆刻印章拓印) stamped in vermilion cinnabar seal-paste (朱砂印泥) on a fully transparent background — only the red ink marks, no paper, no background, no shadow. A stylized compass-needle / direction motif enclosed within a square seal border, with authentic weathered carved-stone texture, slightly uneven hand-stamped edges and small broken ink gaps. Bold and weighty, vermilion red only (no other color), centered, square 1:1, high resolution.
```

**2 — 勤学 → `s-qinxue.png`**
```
A traditional Chinese carved seal impression (篆刻印章拓印) stamped in vermilion cinnabar seal-paste (朱砂印泥) on a fully transparent background — only the red ink marks, no paper, no background, no shadow. A single upright calligraphy-brush motif enclosed within a square seal border, with authentic weathered carved-stone texture, slightly uneven hand-stamped edges and small broken ink gaps. Bold and weighty, vermilion red only (no other color), centered, square 1:1, high resolution.
```

**3 — 不辍 → `s-buchuo.png`**
```
A traditional Chinese carved seal impression (篆刻印章拓印) stamped in vermilion cinnabar seal-paste (朱砂印泥) on a fully transparent background — only the red ink marks, no paper, no background, no shadow. A rising flame motif enclosed within a square seal border, with authentic weathered carved-stone texture, slightly uneven hand-stamped edges and small broken ink gaps. Bold and weighty, vermilion red only (no other color), centered, square 1:1, high resolution.
```

**4 — 通透 → `s-tongtou.png`**
```
A traditional Chinese carved seal impression (篆刻印章拓印) stamped in vermilion cinnabar seal-paste (朱砂印泥) on a fully transparent background — only the red ink marks, no paper, no background, no shadow. A concentric-circles motif with a center dot (suggesting clarity / insight) enclosed within a round seal border, with authentic weathered carved-stone texture, slightly uneven hand-stamped edges and small broken ink gaps. Bold and weighty, vermilion red only (no other color), centered, square 1:1, high resolution.
```

**5 — 大成 → `s-dacheng.png`**
```
A traditional Chinese carved seal impression (篆刻印章拓印) stamped in vermilion cinnabar seal-paste (朱砂印泥) on a fully transparent background — only the red ink marks, no paper, no background, no shadow. A 3x3 interlocking lattice / grid motif (suggesting a completed map) enclosed within a square seal border, with authentic weathered carved-stone texture, slightly uneven hand-stamped edges and small broken ink gaps. Bold and weighty, vermilion red only (no other color), centered, square 1:1, high resolution.
```

**6 — 博学 → `s-boxue.png`**
```
A traditional Chinese carved seal impression (篆刻印章拓印) stamped in vermilion cinnabar seal-paste (朱砂印泥) on a fully transparent background — only the red ink marks, no paper, no background, no shadow. An open-book / stacked-scrolls motif enclosed within a square seal border, with authentic weathered carved-stone texture, slightly uneven hand-stamped edges and small broken ink gaps. Bold and weighty, vermilion red only (no other color), centered, square 1:1, high resolution.
```

**7 — 登峰 → `s-dengfeng.png`**
```
A traditional Chinese carved seal impression (篆刻印章拓印) stamped in vermilion cinnabar seal-paste (朱砂印泥) on a fully transparent background — only the red ink marks, no paper, no background, no shadow. A mountain-peak motif enclosed within a square seal border, with authentic weathered carved-stone texture, slightly uneven hand-stamped edges and small broken ink gaps. Bold and weighty, vermilion red only (no other color), centered, square 1:1, high resolution.
```

**8 — 月课 → `s-yueke.png`**
```
A traditional Chinese carved seal impression (篆刻印章拓印) stamped in vermilion cinnabar seal-paste (朱砂印泥) on a fully transparent background — only the red ink marks, no paper, no background, no shadow. A crescent-moon motif enclosed within a round seal border, with authentic weathered carved-stone texture, slightly uneven hand-stamped edges and small broken ink gaps. Bold and weighty, vermilion red only (no other color), centered, square 1:1, high resolution.
```

**9 — 治学 → `s-zhixue.png`**
```
A traditional Chinese carved seal impression (篆刻印章拓印) stamped in vermilion cinnabar seal-paste (朱砂印泥) on a fully transparent background — only the red ink marks, no paper, no background, no shadow. A scholarly academy gate with an eaved roof motif enclosed within a square seal border, with authentic weathered carved-stone texture, slightly uneven hand-stamped edges and small broken ink gaps. Bold and weighty, vermilion red only (no other color), centered, square 1:1, high resolution.
```

---

## 接入约定（出图后我来做）

- **文房**：8 张丢进 `web/public/decor/`，我把书斋装点从 SVG 切成图片 + 放大案头展示。
- **印章**：9 张丢进 `web/public/seals/`，我把印章雅号从 SVG 切成图片（保留朱红仪式色）。
- **看板娘画风**：2 张丢进 `web/public/portraits/`，绑到 Pro 画风主题（theme face）。
- **看板娘场景/季节**：丢进 `web/public/portraits/`，在 `portraits.ts` 注册进形象集对应系列（解锁绑学习里程碑）。
- 太满/太细的，对该条追加：`make it more minimal, fewer strokes, more empty space`。
