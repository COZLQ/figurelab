import type { Metadata } from "next";
import "@xyflow/react/dist/style.css";
import "./globals.css";
import "./ai.css";

export const metadata: Metadata = {
  title: "FigureLab — 让研究，清晰可见",
  description: "可编辑、可保存、可导出矢量图的科研图形工作台。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
