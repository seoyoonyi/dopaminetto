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
  title: "Dopaminetto(Coming soon)",
  description: "Dopaminetto Side Project",
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
