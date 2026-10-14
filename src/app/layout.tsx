import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "온기 (Warmth) — 둘만의 비밀 교환일기",
  description: "서재 책상 위에 놓인 가죽 양장 다이어리와 편지 봉투. 하루걸러 쓰는 턴제 교환일기 서비스 온기.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "온기",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#FAF7F2",
};

import { LanguageProvider } from "@/lib/i18n";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full overflow-hidden antialiased" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body
        suppressHydrationWarning
        className="h-full overflow-hidden flex flex-col font-serif-warm bg-[#FAF7F2] text-[#2C2A29] selection:bg-[#6B1724]/20 selection:text-[#6B1724]"
      >
        {/* iOS PWA Standalone 상단 바 시스템 블러 완전 차단용 솔리드 세이프에어리어 필러 */}
        <div
          aria-hidden="true"
          className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none bg-[#FAF7F2]"
          style={{ height: "env(safe-area-inset-top, 0px)" }}
        />
        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
