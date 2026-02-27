/**
 * ============================================================
 * Hush Pointer: File Header
 * ============================================================
 * @file env.d.ts
 * @module hush-pointer/types
 * @summary Vite環境変数とグローバル定数の型定義
 *
 * @responsibilities
 * - ImportMetaEnvの型安全を提供する
 * - __APP_VERSION__の型を宣言する
 *
 * @invariants
 * - 必須のFirebase envキー型を常に保持する
 *
 * @sideEffects
 * - none
 *
 * @dependencies
 * - vite import.meta env typing
 *
 * @updated 2026-02-27
 * @changelog ヘッダコメントを追加
 * ============================================================
 */
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
  readonly VITE_FIREBASE_APPCHECK_SITE_KEY?: string;
  readonly VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_OPENAI_MODEL?: string;
  readonly VITE_OPENAI_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
