import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import react from "eslint-plugin-react";
import unusedImports from "eslint-plugin-unused-imports";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  {
    plugins: {
      "unused-imports": unusedImports,
      react,
    },
    rules: {
      "react/jsx-key": "error",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      // Turn off the default no-unused-vars rule (replaced by unused-imports plugin)
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/set-state-in-effect": "warn",
      // Warn about unused imports (auto-fixable)
      "unused-imports/no-unused-imports": "warn",
      // Warn about unused variables (not auto-fixable, but helps catch issues)
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "node:test",
              message: "Use vitest instead of node:test",
            },
            {
              name: "next/router",
              message: "Use router from next/navigation instead",
            },
          ],
          patterns: [
            {
              group: ["@radix-ui", "@radix-ui/*"],
              message: "Import from ui/components or add new ShadCN component instead",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/components/ui/**",
    "eslint.config.mjs",
  ]),
]);

export default eslintConfig;
