import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // tsconfig의 "jsx": "preserve"는 Next.js(SWC)가 소비하는 설정이다. Vite 8의 기본 oxc
  // 트랜스폼이 이 값을 그대로 이어받아 JSX를 변환하지 않고 그대로 두면 rolldown 파서가
  // "Unexpected JSX expression"으로 실패하므로, 테스트에서는 automatic 런타임으로 강제한다.
  oxc: {
    jsx: {
      runtime: "automatic",
    },
  },
});
