import { Toaster } from "@/shared/ui/sonner";

import type { Metadata } from "next";
import localFont from "next/font/local";

import AppProviders from "./providers/AppProviders";

import "./globals.css";

// next/font로 로컬 폰트를 불러와 CSS 변수로 노출
const pretendard = localFont({
  src: "../../public/assets/fonts/Pretendard-Regular.woff",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-pretendard",
});

const galmuri9 = localFont({
  src: "../../public/assets/fonts/Galmuri9.woff2",
  display: "swap",
  variable: "--font-galmuri9",
});

export const metadata: Metadata = {
  title: {
    template: "도파민또 | 글또에서 이어진 개발자 글쓰기 & 성장 공간 | %s",
    default: "도파민또 | 글또에서 이어진 개발자 글쓰기 & 성장 공간",
  },
  description:
    "글또에서 이어진 도파민또는 개발자 글쓰기와 성장을 위한 온라인 공간입니다. 지식과 경험을 나누며, 공감을 통해 배우고 즐겁게 성장할 수 있는 글쓰기 경험을 제공합니다.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "도파민또 | 글또에서 이어진 개발자 글쓰기 & 성장 공간",
    description:
      "글또에서 이어진 도파민또는 개발자 글쓰기와 성장을 위한 온라인 공간입니다. 지식과 경험을 나누며, 공감을 통해 배우고 즐겁게 성장할 수 있는 글쓰기 경험을 제공합니다.",
    siteName: "도파민또 | 글또에서 이어진 개발자 글쓰기 & 성장 공간",
    url: "https://dopamine-tto.vercel.app",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${galmuri9.variable}`}>
      <body className="antialiased font-sans">
        <AppProviders>{children}</AppProviders>
        <Toaster position="top-left" />
      </body>
    </html>
  );
}
