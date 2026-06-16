# Telos 出图 Prompt 母版

> 工具：**GPT img-2（gpt-image-1）**。每条 prompt **独立完整、复制即用，无需拼接**。
> 建议同组在一个会话里连续生成，风格最连贯。

> ⚠️ **透明底**：GPT img-2 即便 prompt 写 "transparent background" 也几乎**总是输出白底、无 alpha 通道**（甚至把透明棋盘格当像素画进去）。直接用会在纸色/卡片上露白方块。
> 交给我接代码时**我会离线批处理抠成真透明**（印章=红色键控；墨绘/看板娘=边缘洪泛 + 小封闭洞清除）——你只管生成，**不必自己处理透明**。
> 另：GPT 出图都是 1254px、1–2MB/张的巨图，直接上线会**慢得可怕**（形象集一次 32 张 = 几十 MB）。我会顺手**缩到展示尺寸 + 转 WebP**（看板娘 600px / 印章 256px / 文房 320px），整批 ~82MB → ~3MB；网格图再加 `loading=lazy` 懒加载。出大图即可，压缩交给我。



## 生成进度（全部完成 + 已接入代码 · 2026-06-15）

✅ **全部生成并接线完毕**，无待办。形象集已达 **32 张**（日常 14 + 里程碑 2 + 场景 10 + 季节 4 + 画风 2）。

| 组 | 文件 | 接入位置 | 状态 |
|---|---|---|---|
| 画风（Pro 主题） | `face-ink`（泼墨飞白）· `woodcut`（强对比重做版） | `portraits.ts` theme 系列 | ✅ 2 |
| 季节 | `season-spring/summer/autumn/winter` | season 系列（`id` 不变，`file` 指到 season-*） | ✅ 4 |
| 场景 | 旧 5 `scene-lectern/nightread/shelves/annotate/summit` + 新 5 `scene-desk/window/tea/night(秉烛)/stroll` | scene 系列，各绑不同学习里程碑 | ✅ 10 |
| 日常神态 | `ponder/nod` + 重做 `applaud`（鼓掌）`lantern`（举灯） | daily 系列 | ✅ |
| 里程碑 | 重做 `zongshi`（抱卷·大师气度） | milestone 系列 | ✅ |
| 文房清玩 | `d-bitong/zhenzhi/juan/penjing/xianglu/chaju/guqin/shanshui` | `studio-room.tsx` SVG→PNG | ✅ 8 |
| 印章 | `s-qicheng/qinxue/buchuo/tongtou/dacheng/boxue/dengfeng/yueke/zhixue` | `studio-seals.tsx` + `me` 荣誉徽 SVG→PNG | ✅ 9 |

> 说明：`face-cut`（细线木刻）已留作备用，木刻主题最终用了更有刀感的 `woodcut`。所有立绘解锁照旧绑真实学习里程碑，纯外观零学习侧优势。

---

## ✅ 已重做完成（applaud / zongshi / lantern / woodcut · 2026-06-15）

下面 4 张已按重做 prompt 重新生成并覆盖到位、确认合格（鼓掌 / 抱卷大师气度 / 举灯到脸侧 / 强刀感木刻）。prompt 留作日后微调参考。每条都**需上传 hero.png**，沿用本文件看板娘模板、风格统一。

| 文件 | 问题 |
|---|---|
| `applaud.png` | 现在是双手合十（像祈愿/感谢），不是「嘉许」该有的鼓掌赞许，所以显得没劲 |
| `zongshi.png` | 只是普通职业抱臂、和别的形象一样年轻，缺「宗师」的大师气度 |
| `lantern.png` | 其实画了马灯，但灯在手部偏下，形象集圆形缩略图（只取上半张脸）把灯裁掉了 → 看着像没灯；要把灯举高到脸侧 |
| `woodcut.png`（可选） | 偏钢笔细排线，木刻的强黑白对比 / 刀痕分量不够 |

**嘉许 → 覆盖 `applaud.png`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide: a black-and-white hand-drawn ink-line illustration of the SAME young female teacher — keep her face, hairstyle, glasses, line style and gentle scholarly demeanor identical to the reference. She is applauding warmly, both hands clapping at chest height with a bright proud smile, an uplifting and encouraging mood — NOT hands pressed together as if praying, NOT a tired or melancholic look. Clean confident ink linework, warm mood, transparent background, no color. Half-body framing, centered, square 1:1, high resolution.
```

**宗师 → 覆盖 `zongshi.png`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide: a black-and-white hand-drawn ink-line illustration of the SAME young female teacher — keep her recognizable (face, hairstyle, glasses) but render her with the gravitas of a seasoned grandmaster: a dignified, composed bearing — standing tall with hands clasped behind her back, or holding a closed book against her chest, a calm and authoritative gaze, an aura of deep accumulated wisdom and quiet command. A touch more mature and commanding than her everyday look, while staying the same person. Clean confident ink linework, dignified mood, transparent background, no color. Three-quarter or half-body framing, centered, square 1:1, high resolution.
```

**执灯 → 覆盖 `lantern.png`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide: a black-and-white hand-drawn ink-line illustration of the SAME young female teacher — keep her face, hairstyle, glasses, line style and gentle scholarly demeanor identical to the reference. She holds up a glowing oil lantern beside her face at eye level, the lantern large, clearly visible and prominent in the UPPER half of the frame (so it stays in view even when cropped to a circle), warm light catching her face, a calm guiding expression. Clean confident ink linework, transparent background, no color. Half-body framing, centered, square 1:1, high resolution.
```

**木刻（可选加强）→ 覆盖 `woodcut.png`**
```
Using the uploaded reference image (hero.png) to keep the SAME young woman recognizable (her face shape, hairstyle and glasses), re-imagine her half-body portrait as a BOLD black-and-white woodcut / woodblock print: strong high-contrast masses of solid black and solid white, thick decisive carved gouge marks, dramatic chiaroscuro and graphic heft — NOT fine even pen hatching, NOT thin gray lines. Pure black ink on a fully transparent background, no color. Centered, square 1:1, high resolution.
```

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

## 六、案头背景 〔无需参考；横构图〕

「一方案头」身后的**极淡书斋氛围背景**，衬在几案 + 文房陈设之后（陈设是前景，背景只负责气氛）。**任选一张**生成即可；给我原图，我负责缩放 + 转 WebP + 接入（命名 `_studio`），并把几案/陈设叠在它前面。

**硬要求（务必遵守，否则会盖住前景陈设）**：
- **横向构图（约 3:2 或 16:9）**，主体氛围集中在**上 2/3**；**下 1/3 必须大面积留白**（几案和文房会摆在那里）。
- **极淡、空灵**：大量留白，墨色只在边角轻扫；**不要**浓墨大色块、不要画到中下部。
- **前景不要有任何家具**（桌、案、椅都不要——几案是代码画的）；不要人物。
- 纯黑白写意水墨，白底即可（透明与否都行，我会处理）。

**A — 临窗（推荐）→ 原图给我，我存 `_studio`**
```
A traditional Chinese xieyi (写意) freehand ink-wash painting used as a faint, airy background for a scholar's studio: a wooden lattice window in the upper area with soft diffused daylight coming through, a few delicate bamboo leaf shadows, and a great deal of empty pale negative space. Very light and minimal — pale gray ink washes only in the upper two-thirds, the entire lower third left almost entirely blank white. No furniture, no desk, no table, no chair, no people — only the suggestion of a quiet study wall and window. Pure black ink on white, soft and understated, wide landscape composition (3:2), high resolution.
```

**B — 挂画墙 → 原图给我，我存 `_studio`**
```
A traditional Chinese xieyi (写意) freehand ink-wash painting used as a faint, airy background for a scholar's studio: a quiet pale wall with a single hanging landscape scroll (山水挂轴) drifting in the upper-left, a faint wisp of incense smoke, and abundant empty negative space. Very light and minimal — soft gray ink only in the upper two-thirds, the entire lower third left almost blank white. No furniture, no desk, no table, no people — only a serene empty studio wall. Pure black ink on white, understated and spacious, wide landscape composition (3:2), high resolution.
```

> 出图后我接：`.room-stage` 衬这张背景（顶部对齐 + 底部渐隐到纸色），几案与陈设浮在前面；案头会从「一条墨线托面」升级成「一方真书斋」。

---

## 七、造型换装 · 套装 〔需上传 hero.png〕

衣橱里给看板娘换的**整套着装**。铁律：**所有套装用同一个签名姿势，只换衣服**——这样既是真「换装」(同一个她、换装感强)，二期还能在签名姿上叠配饰(团扇/书卷/发簪)做 mix-match。给我原图，我缩放+抠透明+转 WebP 接入(命名 `outfit-<id>`)，绑墨价/解锁。

**签名姿(每张都照此，务必一致)**：半身、身体微侧 3/4、双手在身前轻轻交叠、平和浅笑、目视前方——和 hero 同一姿态，只有衣着不同。黑白墨线、透明底、1:1。

> 默认「教师装」用现有立绘(present/hero)，**无需生成**。下面 6 套按需生成，先做哪套都行。

**1 — 汉服·宋制 → `outfit-songhanfu`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide — keep her face, hairstyle, glasses, gentle scholarly demeanor and black-and-white hand-drawn ink-line style identical. Signature pose: half-body, body turned slightly three-quarter, both hands lightly clasped in front, calm soft smile, looking forward. She is wearing an elegant restrained Song-dynasty hanfu — a long slim 褙子 (open-front overrobe) over an inner garment and long skirt, simple refined scholarly cut, no loud patterns. Clean confident ink linework, transparent background, no color. Square 1:1, high resolution.
```

**2 — 唐风 → `outfit-tang`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide — keep her face, hairstyle, glasses, demeanor and black-and-white ink-line style identical. Signature pose: half-body, slight three-quarter turn, both hands lightly clasped in front, calm soft smile. She is wearing a graceful Tang-style 襦裙 (ruqun) with gently flowing wide sleeves and a high-waisted long skirt, soft draping, dignified and airy. Clean confident ink linework, transparent background, no color. Square 1:1, high resolution.
```

**3 — 便装·针织 → `outfit-knit`**
```
Using the uploaded reference image (hero.png) as the exact character and style guide — keep her face, hairstyle, glasses, demeanor and black-and-white ink-line style identical. Signature pose: half-body, slight three-quarter turn, both hands lightly clasped in front, calm soft smile. She is wearing a cozy relaxed everyday outfit — a soft oversized chunky-knit cardigan over a simple collared shirt, casual and warm. Clean confident ink linework, transparent background, no color. Square 1:1, high resolution.
```

**4 — 学位袍 → `outfit-gown`**（里程碑：学完 1 张图谱解锁）
```
Using the uploaded reference image (hero.png) as the exact character and style guide — keep her face, hairstyle, glasses, demeanor and black-and-white ink-line style identical. Signature pose: half-body, slight three-quarter turn, both hands lightly clasped in front, a quietly proud calm smile. She is wearing an academic graduation gown with draped open front and a hood/stole over the shoulders, dignified and ceremonial. Clean confident ink linework, transparent background, no color. Square 1:1, high resolution.
```

**5 — 冬·氅衣 → `outfit-cloak`**（季节：冬季限定）
```
Using the uploaded reference image (hero.png) as the exact character and style guide — keep her face, hairstyle, glasses, demeanor and black-and-white ink-line style identical. Signature pose: half-body, slight three-quarter turn, both hands lightly clasped in front, calm soft smile. She is wearing a heavy winter 氅衣 / long wrapped cloak with a soft fur-trimmed collar, draped warm over her shoulders, a few faint snowflakes suggested. Clean confident ink linework, transparent background, no color. Square 1:1, high resolution.
```

**6 — 节庆·华服 → `outfit-festive`**（季节/节庆限定）
```
Using the uploaded reference image (hero.png) as the exact character and style guide — keep her face, hairstyle, glasses, demeanor and black-and-white ink-line style identical. Signature pose: half-body, slight three-quarter turn, both hands lightly clasped in front, a bright gentle festive smile. She is wearing an ornate festive formal robe with delicate auspicious patterning and fuller decorative sleeves, celebratory yet tasteful. Pure black-and-white ink only (no color, no red). Clean confident ink linework, transparent background. Square 1:1, high resolution.
```

---

## 接入约定（出图后我来做）

- **造型换装**：套装原图丢给我（第七组），我抠透明+转 WebP 存 `web/public/portraits/outfit-<id>.webp` + 注册进衣橱（绑墨价/解锁），上架即可花墨换上。
- **案头背景**：1 张丢给我（第六组），我缩放/转 WebP 存 `web/public/decor/_studio.webp` + 接入 `.room-stage`，并按实际微调高度/渐隐。
- **文房**：8 张丢进 `web/public/decor/`，我把书斋装点从 SVG 切成图片 + 放大案头展示。
- **印章**：9 张丢进 `web/public/seals/`，我把印章雅号从 SVG 切成图片（保留朱红仪式色）。
- **看板娘画风**：2 张丢进 `web/public/portraits/`，绑到 Pro 画风主题（theme face）。
- **看板娘场景/季节**：丢进 `web/public/portraits/`，在 `portraits.ts` 注册进形象集对应系列（解锁绑学习里程碑）。
- 太满/太细的，对该条追加：`make it more minimal, fewer strokes, more empty space`。
