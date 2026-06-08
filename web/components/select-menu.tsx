"use client";

// 自定义下拉（替代原生 <select> 的系统框，贴合纯黑白手绘风）。
// portal 到 body：避开 .appbar 的 backdrop-filter / 已 portal 的切换器面板的包含块。
// 无障碍：组合框按钮 + 列表框，↑↓/Home/End/Enter/Esc 全可达，点外/滚动/缩放即关。
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icon";

export interface MenuOption {
  value: string;
  label: string;
}

export function SelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  align = "start",
  trigger,
}: {
  value: string;
  options: MenuOption[];
  onChange: (v: string) => void;
  ariaLabel: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: "start" | "end";
  trigger: (current: MenuOption, open: boolean) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; minW: number } | null>(null);
  const [active, setActive] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const current = options.find((o) => o.value === value) ?? options[0];
  const curIndex = Math.max(0, options.findIndex((o) => o.value === value));

  const openMenu = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) {
      const minW = Math.max(Math.round(r.width), 150);
      const left = align === "end" ? Math.max(8, Math.round(r.right) - minW) : Math.round(r.left);
      setPos({ top: Math.round(r.bottom) + 6, left, minW });
    }
    setActive(curIndex);
    setOpen(true);
  }, [align, curIndex]);

  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.focus();
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onMove = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const o = options[active];
      if (o) choose(o.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  return (
    <div className={className}>
      <button
        ref={btnRef}
        type="button"
        className={buttonClassName}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openMenu();
          }
        }}
      >
        {trigger(current, open)}
      </button>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className={`selmenu ${menuClassName}`.trim()}
            role="listbox"
            aria-label={ariaLabel}
            aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
            tabIndex={-1}
            style={{ top: pos.top, left: pos.left, minWidth: pos.minW }}
            onKeyDown={onKey}
          >
            {options.map((o, i) => (
              <button
                key={o.value}
                id={`${listId}-${i}`}
                type="button"
                role="option"
                aria-selected={o.value === value}
                data-active={i === active}
                className={`selmenu-opt ${o.value === value ? "on" : ""} ${i === active ? "active" : ""}`.trim()}
                onMouseMove={() => active !== i && setActive(i)}
                onClick={() => choose(o.value)}
              >
                <span>{o.label}</span>
                {o.value === value && <Icon name="check" />}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
