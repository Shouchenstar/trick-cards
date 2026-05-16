import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tauri 桌面端需要 static export（无 Node.js 服务端）
  output: "export",
  // 关闭 Next.js 自带的 dev indicator（左下角带 N 字样的英文浮窗）。
  // 它由 Next.js 框架渲染，目前没有中文化选项，只能整体关闭。
  devIndicators: false,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
