import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "out/**",
      "prisma/migrations/**",
      ".claude/**"
    ]
  },
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/exhaustive-deps": "off"
    }
  }
];

export default eslintConfig;

