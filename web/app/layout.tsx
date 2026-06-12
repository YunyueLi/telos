import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SketchDefs } from "@/components/sketch-defs";
import { ChunkGuard } from "@/components/chunk-guard";
import { ProjectProvider } from "@/lib/telos/use-project";
import { AuthProvider } from "@/lib/telos/auth";
import { LangProvider } from "@/lib/telos/i18n";

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
        <LangProvider>
          <AuthProvider>
            <ProjectProvider>{children}</ProjectProvider>
          </AuthProvider>
        </LangProvider>
      </body>
    </html>
  );
}
