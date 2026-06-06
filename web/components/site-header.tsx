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
          <Link href="/">目标</Link>
          <Link href="/map">学习地图</Link>
          <Link href="/learn/jwt">学习中</Link>
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
