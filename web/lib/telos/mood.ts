"use client";

// 情境神态：看板娘随当前学习状态自动换神态 + 说话——"活的"陪伴，不只一张手动选的死图。
// 手动选的形象是"默认装扮"；情境（迎新/达标喝彩/诊断完/连胜中）会临时覆盖它。
// idle 返回 null = 用用户在形象集里手动选的陪伴形象。
export type Mood = "welcome" | "celebrate" | "diagnosed" | "streaking" | "idle";

export function moodFace(mood: Mood): { file: string; voiceKey: string } | null {
  switch (mood) {
    case "welcome":
      return { file: "welcome", voiceKey: "mood.welcome" };
    case "celebrate":
      return { file: "cheer", voiceKey: "mood.celebrate" };
    case "diagnosed":
      return { file: "think", voiceKey: "mood.diagnosed" };
    case "streaking":
      return { file: "notify", voiceKey: "mood.streaking" };
    case "idle":
      return null;
  }
}
