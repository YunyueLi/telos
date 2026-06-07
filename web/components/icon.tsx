export type IconName =
  | "check" | "lock" | "flag" | "target" | "arrow" | "up" | "clock"
  | "gauge" | "play" | "refresh" | "plus" | "spark" | "home" | "map"
  | "user" | "compass" | "settings" | "trash";

export function Icon({
  name,
  sketch = true,
  className = "",
  style,
}: {
  name: IconName;
  sketch?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg className={`ic ${sketch ? "sk" : ""} ${className}`.trim()} style={style} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
