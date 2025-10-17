// .lintstagedrc.js

module.exports = {
  // TypeScript, JavaScript 파일에 대해 Prettier 포맷팅과 ESLint 검사를 실행
  "**/*.{ts,tsx,js,jsx}": ["prettier --write", "eslint --fix"],
  // 기타 파일(JSON, Markdown 등)에 대해서는 Prettier 포맷팅만 실행
  "**/*.{json,md,yml}": ["prettier --write"],
};
