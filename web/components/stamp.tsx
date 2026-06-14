"use client";

// 统一「印章」组件：黑白墨印 / 邮戳风（双圈 + 点线边 + 图标），用于成就、里程碑等里程碑视觉。
// 已达成 = 墨色实心印 + 轻微歪斜（像手工盖上去的真实感，呼应手绘墨线语言）；未达成 = 浅灰空印。
import { Icon, type IconName } from "@/components/icon";

export function Stamp({ icon, on, className = "" }: { icon: IconName; on: boolean; className?: string }) {
  return (
    <span className={`stamp ${on ? "on" : ""} ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 64 64" className="stamp-ring">
        <circle cx="32" cy="32" r="29" className="stamp-o1" />
        <circle cx="32" cy="32" r="23.5" className="stamp-o2" strokeDasharray="1.6 3.2" />
      </svg>
      <Icon name={icon} className="stamp-ic" />
    </span>
  );
}
