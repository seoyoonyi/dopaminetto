import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/widgets/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/entities/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/shared/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // 기본 본문 폰트
        sans: [
          "var(--font-pretendard)",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Noto Sans KR",
          "sans-serif",
        ],
        // 강조/포인트 폰트
        display: [
          "var(--font-galmuri9)",
          "var(--font-pretendard)",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
