/**
 * ============================================================
 * Hush Pointer: File Header
 * ============================================================
 * @file main.tsx
 * @module hush-pointer/bootstrap
 * @summary Reactアプリのエントリーポイント
 *
 * @responsibilities
 * - AppコンポーネントをDOMへマウントする
 *
 * @invariants
 * - ルート要素に単一のReactツリーを描画する
 *
 * @sideEffects
 * - DOM render
 *
 * @dependencies
 * - react
 * - react-dom/client
 * - ./App.tsx
 *
 * @updated 2026-02-27
 * @changelog ヘッダコメントを追加
 * ============================================================
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
