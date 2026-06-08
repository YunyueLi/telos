// 服务条款（独立静态页，贴合 App 设计）。用于 Google OAuth 品牌信息的「服务条款链接」字段。中英双语。
import Link from "next/link";
import { Icon } from "@/components/icon";

export const metadata = {
  title: "服务条款 · Telos",
  description: "Telos 服务条款 / Terms of Service",
};

export default function TermsPage() {
  return (
    <div className="legal">
      <header className="legal-top">
        <Link href="/" className="legal-brand">
          <svg className="sk" viewBox="0 0 24 24" aria-hidden="true">
            <use href="#i-compass" />
          </svg>
          <span>Telos</span>
        </Link>
        <Link href="/privacy" className="legal-navlink">
          隐私政策 <Icon name="arrow" />
        </Link>
      </header>

      <article className="legal-doc">
        <div className="eyebrow">服务条款 · Terms</div>
        <h1>服务条款</h1>
        <p className="legal-date">最近更新：2026 年 6 月 8 日</p>
        <p>欢迎使用 Telos。使用本服务即表示你同意以下条款。</p>

        <h2>服务说明</h2>
        <p>Telos 是一个逆向设计的学习工具：根据你说出的目标倒推出带前置依赖的能力图谱，诊断起点，只教你缺的，并安排间隔复习。</p>

        <h2>账号</h2>
        <p>你需对自己账号下的活动以及登录凭据的安全负责。请勿与他人共享账号。</p>

        <h2>可接受的使用</h2>
        <p>请仅将 Telos 用于合法的个人学习用途，不得滥用、干扰或试图攻击本服务。</p>

        <h2>AI 内容免责</h2>
        <p>能力图谱、微课、测题等内容由 AI 生成，<b>可能存在错误或不准确</b>，仅供学习参考，不构成专业、医疗、法律或投资建议。请自行核实重要信息。</p>

        <h2>知识产权</h2>
        <p>你创建的学习数据归你所有。Telos 产品本身的代码以其开源许可为准。</p>

        <h2>服务"按现状"提供</h2>
        <p>我们会尽力维护服务，但不保证其不间断或完全无误，并可能随时调整、新增或停止部分功能。</p>

        <h2>条款变更</h2>
        <p>条款如有更新，将在本页公布。继续使用即表示接受更新后的条款。</p>

        <h2>联系方式</h2>
        <p><a href="mailto:xuanlyy@gmail.com">xuanlyy@gmail.com</a></p>

        <hr className="legal-hr" />

        <div className="eyebrow">Terms of Service</div>
        <h1>Terms of Service</h1>
        <p className="legal-date">Last updated: June 8, 2026</p>
        <p>Welcome to Telos. By using the service you agree to the terms below.</p>

        <h2>The service</h2>
        <p>Telos is a backward-design learning tool: from a goal you state, it derives a prerequisite skill map, diagnoses your starting point, teaches only what you’re missing, and schedules spaced review.</p>

        <h2>Account</h2>
        <p>You are responsible for activity under your account and for keeping your credentials secure. Don’t share your account.</p>

        <h2>Acceptable use</h2>
        <p>Use Telos only for lawful, personal learning. Do not abuse, disrupt, or attempt to attack the service.</p>

        <h2>AI content disclaimer</h2>
        <p>Skill maps, lessons, and quizzes are AI-generated and <b>may contain errors</b>. They are for learning reference only and do not constitute professional, medical, legal, or financial advice. Verify important information yourself.</p>

        <h2>Intellectual property</h2>
        <p>Your learning data is yours. The Telos product code is governed by its open-source license.</p>

        <h2>Provided “as is”</h2>
        <p>We maintain the service in good faith but do not guarantee it is uninterrupted or error-free, and we may change, add, or discontinue features at any time.</p>

        <h2>Changes</h2>
        <p>Updates to these terms will be posted on this page. Continued use means you accept the updated terms.</p>

        <h2>Contact</h2>
        <p><a href="mailto:xuanlyy@gmail.com">xuanlyy@gmail.com</a></p>

        <Link href="/" className="legal-back">
          <Icon name="arrow" style={{ transform: "rotate(180deg)" }} /> 返回 Telos
        </Link>
      </article>
    </div>
  );
}
