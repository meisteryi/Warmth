import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS === "true";
const isStaticExport = process.env.STATIC_EXPORT === "true" || isGithubActions;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || (isGithubActions ? "/Warmth" : "");

const nextConfig: NextConfig = {
  // GitHub Actions 배포 시에는 static export, Vercel/서버리스 환경에서는 API Route 활성화
  output: isStaticExport ? "export" : undefined,
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
