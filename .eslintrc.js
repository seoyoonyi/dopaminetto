module.exports = {
  parser: "@typescript-eslint/parser",
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:@next/next/recommended", // Next.js 추천 규칙
    "prettier", // ✨ Prettier와 충돌하는 ESLint 규칙을 비활성화하므로 반드시 마지막에 와야 합니다.
  ],
  plugins: ["@typescript-eslint", "react", "react-hooks", "jsx-a11y", "import", "filenames"],
  rules: {
    // --- 파일 및 네이밍 규칙 ---
    "filenames/match-regex": ["error", "^[a-z-.@]+$", true], // 파일명은 소문자, 하이픈(-), 마침표(.)만 허용
    "react/jsx-pascal-case": "error", // 컴포넌트 이름은 PascalCase로 작성
    camelcase: ["error", { properties: "never" }], // 변수명은 camelCase로 작성
    "react/jsx-handler-names": [
      // 이벤트 핸들러 네이밍 규칙
      "error",
      {
        eventHandlerPrefix: "handle",
        eventHandlerPropPrefix: "on",
      },
    ],
    "@typescript-eslint/naming-convention": [
      // 변수 타입별 네이밍 규칙
      "error",
      {
        selector: "variable",
        types: ["boolean"],
        format: ["PascalCase"],
        prefix: ["is", "has", "should"],
      },
      {
        selector: "interface",
        format: ["PascalCase"],
        prefix: ["I"],
      },
      {
        selector: "typeAlias",
        format: ["PascalCase"],
        suffix: ["Type"],
      },
    ],

    // --- 코드 스타일 규칙 ---
    "react/destructuring-assignment": ["error", "always"], // props는 항상 구조 분해 할당 사용
    "import/order": [
      // import 순서 규칙
      "error",
      {
        groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object", "type"],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      },
    ],
    "arrow-body-style": ["error", "as-needed"], // 화살표 함수 본문은 필요할 때만 중괄호 사용

    // --- TypeScript 관련 규칙 ---
    "@typescript-eslint/no-explicit-any": "warn", // 'any' 타입 사용 시 경고
    "@typescript-eslint/explicit-function-return-type": "off", // 함수의 반환 타입 명시를 강제하지 않음
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }], // 사용하지 않는 변수 경고

    // --- React/JSX 관련 규칙 ---
    "react/function-component-definition": [
      // 컴포넌트 정의는 화살표 함수만 사용
      2,
      {
        namedComponents: "arrow-function",
        unnamedComponents: "arrow-function",
      },
    ],
    "react/jsx-key": ["error", { checkFragmentShorthand: true }], // map 사용 시 key 속성 강제
    "react/jsx-no-useless-fragment": "error", // 불필요한 Fragment 사용 금지
    "react/react-in-jsx-scope": "off", // Next.js에서는 React를 import할 필요 없음

    // --- 기타 규칙 ---
    "no-console": ["warn", { allow: ["warn", "error"] }], // console.log 사용 시 경고
    "react/prop-types": "off", // TypeScript를 사용하므로 prop-types는 필요 없음
  },
  settings: {
    react: {
      version: "detect", // 설치된 React 버전을 자동으로 감지
    },
    "import/resolver": {
      typescript: {}, // TypeScript 경로 별칭(@/components 등)을 인식하도록 설정
    },
  },
};
