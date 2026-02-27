/**
 * ============================================================
 * Hush Pointer: File Header
 * ============================================================
 * @file eslint.config.js
 * @module hush-pointer/config
 * @summary ESLintフラットコンフィグ定義
 *
 * @responsibilities
 * - TypeScript/React向けlintルールを適用する
 * - dist除外などの共通設定を保持する
 *
 * @invariants
 * - TS/TSXファイルに推奨ルールセットを適用する
 *
 * @sideEffects
 * - none
 *
 * @dependencies
 * - @eslint/js
 * - typescript-eslint
 * - eslint-plugin-react-hooks
 * - eslint-plugin-react-refresh
 *
 * @updated 2026-02-27
 * @changelog ヘッダコメントを追加
 * ============================================================
 */
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
