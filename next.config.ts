import path from "node:path";

import type { NextConfig } from "next";

// 从 STORAGE_PUBLIC_BASE_URL 派生 next/image 远端白名单
// （仅在配置存在时启用 — 留空时不影响构建）
const storagePublicBase = process.env.STORAGE_PUBLIC_BASE_URL?.trim();
const remoteImagePatterns = storagePublicBase
  ? (() => {
      try {
        const u = new URL(storagePublicBase);
        return [
          {
            protocol: u.protocol.replace(":", "") as "http" | "https",
            hostname: u.hostname,
            port: u.port || undefined,
            pathname: "/**",
          },
        ];
      } catch {
        return [];
      }
    })()
  : [];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: remoteImagePatterns,
  },
};

export default nextConfig;
