import js from "@eslint/js";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { security },
    rules: {
      "security/detect-object-injection": "warn",
      "security/detect-non-literal-regexp": "error",
      "security/detect-non-literal-fs-filename": "error",
      "security/detect-unsafe-regex": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-child-process": "error",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-new-buffer": "error",
    },
  },
  {
    ignores: ["dist/**", "build/**", "node_modules/**", ".wrangler/**", "*.config.js", "*.config.mjs", "*.config.ts"],
  }
);
