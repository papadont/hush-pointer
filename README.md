# hush-pointer

`hush-pointer` は、トラックボールでのポインター操作に習熟することを目的としたトレーニング用 Web アプリケーションです。[file:1]  
ブラウザ上で完結し、インストール不要で利用できます。[file:1]

- Web アプリ: https://papadont.github.io/hush-pointer/
- 想定利用者: トラックボールの導入直後のユーザー、ポインター精度の向上や比較評価を行いたいユーザー[file:1]

---

## アプリケーション概要

本アプリケーションは、トラックボール操作における「ポインター位置合わせ」「クリック操作」「線の描画」を繰り返し実行することで、日常的なポインター操作の安定性を高めることを狙いとしています。[file:1]

主な利用シーンは次のとおりです。[file:1]

- トラックボールの基本操作に早期に慣れるためのトレーニング
- 左右クリックの判断と実行の安定化
- 文字・図形・簡単なイラストを用いた細かなポインター制御の練習
- 新規トラックボールの試運転および操作感・比較評価の補助[file:1]

実装は React + TypeScript + Vite によるシングルページアプリケーションです。[file:1]

---

## モード構成

本アプリケーションは、目的の異なる 2 つのモードを提供します。[file:1]

- `HUSH·POINTER`: 反応速度とクリック精度のトレーニング用メインモード[file:1]
- `HUSH·PAINTER`: ポインターの軌跡制御および微調整力向上のための補助モード[file:1]

いずれのモードも、ポインター操作の習熟度向上を目的としています。[file:1]

### HUSH·POINTER（メインモード）

クリック判断の速さと正確さ、狙った位置への素早いポインター移動をトレーニングするモードです。[file:1]

基本ルール:[file:1]

- 制限時間は 60 秒
- 青色ターゲット: 左クリックでヒット
- 赤色ターゲット: 右クリック（または `Ctrl + 左クリック`）でヒット
- 空打ちクリックはミス
- 色に対して誤ったクリック操作もミス扱い

調整可能な項目:[file:1]

- ターゲットサイズ: `2px - 320px`
- 色モード: `left / right / random`
- 音モード: `all / miss / off`
- 視覚エフェクト `aura` の ON/OFF

開始 / 終了操作:[file:1]

- ゲーム未開始時にプレイエリアをダブルクリックすると開始
- 終了後、再度ダブルクリックで再開

表示される結果:[file:1]

- ヒット数 (`hits`)、ミス数 (`miss`)、スコア (`score`)
- 反応時間の中央値 (`median`) と最速値 (`best`)
- 終了時に、色別の反応時間ヒストグラム（18 bins）を表示

スコア仕様（概要）:[file:1]

- ターゲットサイズ、反応時間、描画エリアサイズをもとに基本点を算出
- 連続ヒットによりコンボ倍率が上昇（上限あり）
- ミス 0 で完走した場合、`perfect run` ボーナスを加算
- 最初の 1 反応はウォームアップとして統計から除外

---

### HUSH·PAINTER（補助モード）

トラックボールで狙い通りに線を引くことを目的とした、精密操作の練習モードです。[file:1]

主な用途:[file:1]

- 線・文字・簡単なイラストの描画による微調整力の向上
- 新規トラックボールの初期チェックや操作感の評価

モード切替:[file:1]

- 画面上部タイトルの `HUSH·POINTER / HUSH·PAINTER` をクリックすることでモードを切り替え

描画機能:[file:1]

- 描画ツールとして `brush` と `eraser` を切り替え可能
- 消しゴムは Canvas の `globalCompositeOperation = "destination-out"` を用いて実装
- 消しゴムの線幅はブラシより太く設定（ブラシ線幅のおよそ 2.2 倍）
- `CLEAR` ボタン、または描画エリアのダブルクリックでキャンバス全体をクリア
- Pointer Events を利用しており、マウスやペン入力環境でも扱いやすい設計

色と描画モード:[file:1]

- `mode = left`: 青系のストロークで描画
- `mode = right`: 赤系のストロークで描画
- `mode = random`: 青系と赤系を混ぜたマーブル調で描画

スコア仕様:[file:1]

- 描画量（ストローク長 × 線幅）を `ink` として蓄積
- `paint score = floor(ink / 200) * 2` でスコアを算出
- 画面上には `score / strokes / ink` を表示

---

## 画面構成

画面は次のコンポーネントで構成されています。[file:1]

- ヘッダー  
  アプリ名（クリックでモード切替）、カラースキーム選択（`default / moss / warm / dusk / dark`）、バージョン表示
- 上部パネル  
  タイマー、開始/クリアボタン、スコア関連カード、反応時間カード、設定カード（ターゲットサイズ、色モード、音、`aura`、ツール）
- メッセージバー  
  カラースキーム名、ミス時のメッセージ、現在のツールなどの状態表示
- メインエリア  
  `HUSH·POINTER` モード時はターゲット表示、`HUSH·PAINTER` モード時はキャンバス表示

---

## 技術スタック

本プロジェクトの主な技術スタックは以下のとおりです。[file:1]

- React 19
- TypeScript
- Vite 7
- Tailwind CSS 4（`@tailwindcss/vite`）
- ESLint

---

## ローカル開発

開発環境のセットアップと起動手順は次のとおりです。[file:1]

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Firebase Security Setup (App Check + Firestore Rules)

公開環境で `SAVE` を安全に運用するため、以下を設定してください。

1. Firestore Rules を反映する（`firestore.rules` を使用）
```bash
npm run deploy:rules
```
初回のみログインが必要:
```bash
npm run firebase:login
```
2. Firebase Console で App Check を有効化
- App Check > アプリ（Web）を登録
- provider は reCAPTCHA v3 を選択
- site key を取得
3. 環境変数を設定してビルド/デプロイ
```bash
# .env.local (local)
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_web_app_id
# Optional:
# VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

VITE_FIREBASE_APPCHECK_SITE_KEY=your_recaptcha_v3_site_key

# 任意: ローカル開発で debug token を使う場合
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=true
```

補足:
- API key は公開される可能性がある前提で、Firebase Console 側の API key restrictions を必ず設定してください。
- `VITE_FIREBASE_APPCHECK_SITE_KEY` が未設定だと、本番では App Check が無効のままです。
- Firestore 側で App Check Enforcement を有効化すると、App Check トークンなしの書き込みを拒否できます。
