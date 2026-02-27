/**
 * ============================================================
 * Hush Pointer: File Header
 * ============================================================
 * @file vite.config.ts
 * @module hush-pointer/config
 * @summary Viteビルド設定とアプリバージョン注入
 *
 * @responsibilities
 * - Vite/React/Tailwindプラグイン設定
 * - package.jsonから__APP_VERSION__を定義
 *
 * @invariants
 * - base pathは/hush-pointer/を維持する
 *
 * @sideEffects
 * - Build-time constant injection
 *
 * @dependencies
 * - vite
 * - @vitejs/plugin-react
 * - @tailwindcss/vite
 *
 * @updated 2026-02-27
 * @changelog ヘッダコメントを追加
 * ============================================================
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";

const packageJson=JSON.parse(readFileSync(new URL("./package.json",import.meta.url),"utf-8")) as {version:string};

export default defineConfig({
  define:{
    __APP_VERSION__:JSON.stringify(packageJson.version),
  },
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
  ],
  base: '/hush-pointer/' 
});
