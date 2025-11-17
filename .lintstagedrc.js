module.exports = {
  // TypeScript, JavaScript 파일에 대해 Prettier 포맷팅, ESLint 검사, 타입 체크를 실행
  "**/*.{ts,tsx}": [
    "prettier --write",
    "eslint --fix",
    () => "tsc --noEmit", // 타입 체크 (staged 파일뿐만 아니라 전체 프로젝트)
  ],
  "**/*.{js,jsx}": ["prettier --write", "eslint --fix"],
  // 기타 파일(JSON, Markdown 등)에 대해서는 Prettier 포맷팅만 실행
  "**/*.{json,md,yml}": ["prettier --write"],
};
