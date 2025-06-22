import js from "@eslint/js"
import { globalIgnores } from "eslint/config"
import tseslint from 'typescript-eslint'

export default tseslint.config(
  globalIgnores(['dist']),
  js.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    files: ['src/**/*.ts'],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
    }
  }
)
