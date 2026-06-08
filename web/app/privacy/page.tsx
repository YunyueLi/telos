// 隐私政策（独立静态页，贴合 App 设计：Fraunces 衬线 + 纸感黑白 + 罗盘字标）。
// 用于 Google OAuth 品牌信息的「隐私政策链接」字段，也是产品应有的合规页。中英双语。
import Link from "next/link";
import { Icon } from "@/components/icon";

export const metadata = {
  title: "隐私政策 · Telos",
  description: "Telos 隐私政策 / Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="legal">
      <header className="legal-top">
        <Link href="/" className="legal-brand">
          <svg className="sk" viewBox="0 0 24 24" aria-hidden="true">
            <use href="#i-compass" />
          </svg>
          <span>Telos</span>
        </Link>
        <Link href="/terms" className="legal-navlink">
          服务条款 <Icon name="arrow" />
        </Link>
      </header>

      <article className="legal-doc">
        <div className="eyebrow">隐私政策 · Privacy</div>
        <h1>隐私政策</h1>
        <p className="legal-date">最近更新：2026 年 6 月 8 日</p>
        <p>Telos 是一个逆向设计的学习工具。我们只为「让你学得更好」而收集必要的数据，绝不出售你的任何信息。</p>

        <h2>我们收集什么</h2>
        <ul>
          <li><b>账号信息</b>：你的邮箱（用于注册、登录与跨设备识别）。</li>
          <li><b>学习数据</b>：你输入的学习目标、生成的能力图谱、掌握与复习进度、连胜与每日目标记录。</li>
        </ul>

        <h2>如何使用</h2>
        <ul>
          <li>为你倒推能力图谱、安排只教缺的内容、生成微课与测题。</li>
          <li>跨设备同步你的学习进度，并展示你的连胜、等级等学习统计。</li>
        </ul>

        <h2>数据存储</h2>
        <p>账号与学习数据存储于 <b>Supabase</b>（托管的认证与数据库服务），通过行级安全（RLS）隔离，<b>仅你本人</b>可访问自己的数据。部分数据也会缓存在你设备本地（localStorage）以便离线使用。</p>

        <h2>第三方服务</h2>
        <p>生成学习内容时，我们会将<b>必要的文本</b>（如你输入的学习目标）发送给大模型服务（DeepSeek）与联网检索服务（Tavily），以生成能力图谱与微课。除此之外，我们不向第三方共享你的个人信息，也<b>不出售</b>你的任何数据。</p>

        <h2>你的权利</h2>
        <p>你可随时在应用内查看、导出或删除你的学习数据，或注销账号。需要协助可邮件联系我们。</p>

        <h2>联系方式</h2>
        <p>如对隐私有任何疑问：<a href="mailto:xuanlyy@gmail.com">xuanlyy@gmail.com</a></p>

        <hr className="legal-hr" />

        <div className="eyebrow">Privacy Policy</div>
        <h1>Privacy Policy</h1>
        <p className="legal-date">Last updated: June 8, 2026</p>
        <p>Telos is a backward-design learning tool. We collect only the data needed to help you learn better, and we never sell your information.</p>

        <h2>What we collect</h2>
        <ul>
          <li><b>Account</b>: your email (for sign-up, sign-in, and cross-device identity).</li>
          <li><b>Learning data</b>: the goals you enter, the generated skill maps, your mastery and review progress, and your streak / daily-goal records.</li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To derive your skill map, teach only what you’re missing, and generate lessons and checks.</li>
          <li>To sync your progress across devices and show your learning stats (streak, level, etc.).</li>
        </ul>

        <h2>Storage</h2>
        <p>Account and learning data are stored in <b>Supabase</b> (managed auth + database), isolated by Row-Level Security so that <b>only you</b> can access your own data. Some data is also cached locally on your device.</p>

        <h2>Third parties</h2>
        <p>To generate content, we send the <b>minimum necessary text</b> (e.g. your learning goal) to an LLM provider (DeepSeek) and a web-search provider (Tavily). We do not otherwise share your personal information, and we do <b>not sell</b> any of your data.</p>

        <h2>Your rights</h2>
        <p>You can view, export, or delete your learning data, or delete your account, at any time. Contact us for help.</p>

        <h2>Contact</h2>
        <p>Questions about privacy: <a href="mailto:xuanlyy@gmail.com">xuanlyy@gmail.com</a></p>

        <Link href="/" className="legal-back">
          <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> 返回 Telos
        </Link>
      </article>
    </div>
  );
}
