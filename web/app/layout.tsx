import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SketchDefs } from "@/components/sketch-defs";
import { ChunkGuard } from "@/components/chunk-guard";
import { PWARegister } from "@/components/pwa-register";
import { ProjectProvider } from "@/lib/telos/use-project";
import { AuthProvider } from "@/lib/telos/auth";
import { LangProvider } from "@/lib/telos/i18n";
import { BASE } from "@/lib/base";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});
const jbmono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Telos · 从结果倒推，学会任何事",
  description:
    "说出你想达成的，Telos 倒推出所需技能与知识点，对照你已会的，只教你缺的，边教边验证。",
  applicationName: "Telos",
  manifest: `${BASE}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "Telos", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: `${BASE}/favicon-32.png`, sizes: "32x32", type: "image/png" },
      { url: `${BASE}/favicon-16.png`, sizes: "16x16", type: "image/png" },
      { url: `${BASE}/favicon-48.png`, sizes: "48x48", type: "image/png" },
      { url: `${BASE}/favicon-96.png`, sizes: "96x96", type: "image/png" },
    ], // 浏览器标签 favicon：看板娘正脸头像（avatar，替代早期罗盘/三角占位）
    apple: [{ url: `${BASE}/apple-icon.png`, sizes: "180x180" }], // iOS 主屏：看板娘正脸
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F5F0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // 刘海/灵动岛安全区：standalone 全屏时内容不被遮挡
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-CN"
      className={`${fraunces.variable} ${inter.variable} ${jbmono.variable}`}
    >
      <body>
        <SketchDefs />
        <ChunkGuard />
        <PWARegister />
        <LangProvider>
          <AuthProvider>
            <ProjectProvider>{children}</ProjectProvider>
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
