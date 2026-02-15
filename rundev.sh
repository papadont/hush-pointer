#!/bin/bash

PROJECT_DIR="/Users/hideki/Documents/develop/hush-pointer"
PORT=5173

echo "🔍 $PORT番port調査中..."

# port 5173のプロセス特定＆終了
PIDS=$(lsof -ti:$PORT 2>/dev/null)
if [ -n "$PIDS" ]; then
    echo "👹 $PORT使ってるPID: $PIDS → 終了するよ"
    kill $PIDS
    sleep 1
    # 念のため確認
    if lsof -ti:$PORT >/dev/null 2>&1; then
        echo "⚠️ まだ生きてる！強制終了"
        kill -9 $PIDS
    fi
    echo "✅ port $PORT解放完了"
else
    echo "✅ $PORT空いてるよ"
fi

# ディレクトリ移動＆バックグラウンド起動
cd "$PROJECT_DIR" || { echo "❌ $PROJECT_DIRないよ"; exit 1; }
echo "🚀 hush-pointer起動（バックグラウンド）"
npm run dev &

echo "🎉 完了！ http://localhost:5173 で確認してね"
echo "停止→ pkill -f 'npm.*dev' または Ctrl+C"
