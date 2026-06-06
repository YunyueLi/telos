import Link from "next/link";

export function SiteHeader() {
  return (
    <div className="mast">
      <div className="wrap">
        <Link href="/" className="word">
          <svg className="sk" viewBox="0 0 24 24">
            <use href="#i-compass" />
          </svg>{" "}
          Telos
        </Link>
        <nav className="nav">
          <Link href="/home">首页</Link>
          <Link href="/diagnose">诊断</Link>
          <Link href="/map">地图</Link>
          <Link href="/review">复习</Link>
          <Link href="/profile">我</Link>
        </nav>
        <div className="meta">
          从结果倒推
          <br />
          学会任何事
        </div>
      </div>
    </div>
  );
}
