#!/bin/bash
cd "$(dirname "$0")"

echo "=============================="
echo "  ✦ NoteWise AI — запуск..."
echo "=============================="

# Убиваем всё что висит на порту 3000 и 3001
echo "🧹 Очищаем порты..."
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:3001 | xargs kill -9 2>/dev/null
pkill -f "node server.js" 2>/dev/null
pkill -f "react-scripts" 2>/dev/null
sleep 1

echo "🔧 Запускаем сервер..."
node server.js &
sleep 2

echo "🚀 Запускаем приложение..."
export BROWSER=none   # не открывать новый браузер автоматически
npm start &
sleep 4

# Открываем браузер сами
open http://localhost:3000

echo "✅ NoteWise запущен на http://localhost:3000"
wait
