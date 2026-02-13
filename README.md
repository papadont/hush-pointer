# HUSH·PAINTER

HUSH·PAINTER は、React + TypeScript + Vite で作ったブラウザお絵描きアプリです。

## 主な機能

- ブラシと消しゴムのツール切り替え
- 線幅と色の調整
- Canvas の `destination-out` を使った消しゴム描画

## ローカル開発

```bash
npm install
npm run dev
```

### 利用できるスクリプト

- `npm run dev`: ローカル開発サーバーを起動
- `npm run build`: 型チェックと本番ビルドを実行
- `npm run lint`: ESLint を実行
- `npm run preview`: 本番ビルドをローカルで確認

## デプロイ方針

- 本番デプロイは GitHub Actions で実行します。
- `main` へ push すると GitHub Pages にデプロイされます。
- ローカルから `gh-pages` を使った手動デプロイは行いません。

ワークフローファイル:

- `.github/workflows/deploy-pages.yml`

## 現在のバージョン

- `v1.7`
