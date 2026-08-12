#!/usr/bin/env bash
# ============================================================
# NEVIO: генератор иконок из одного логотипа
# Использование:  bash make-icons.sh путь/к/logo.png
# Требуется: ImageMagick (команда convert), есть в Linux/macOS,
#            для Windows — WSL или вариант 2 из README (favicon.io)
# ============================================================
set -e

SRC="${1:-logo.png}"

if [ ! -f "$SRC" ]; then
  echo "❌ Файл не найден: $SRC"
  echo "   Использование: bash make-icons.sh путь/к/logo.png"
  exit 1
fi

echo "🔧 Генерирую иконки из $SRC ..."

# Главная фавиконка 512×512 (квадрат: если логотип не квадратный — обрезаем по центру)
convert "$SRC" -resize 512x512^ -gravity center -extent 512x512 favicon.png

# Остальные размеры
convert favicon.png -resize 180x180 apple-touch-icon.png
convert favicon.png -resize 192x192 android-chrome-192.png
cp favicon.png android-chrome-512.png

# Классическая .ico с размерами 16/32/48 (для старых браузеров и Google)
convert favicon.png -define icon:auto-resize=16,32,48 favicon.ico

echo "✅ Готово! Созданы файлы:"
ls -la favicon.png favicon.ico apple-touch-icon.png android-chrome-192.png android-chrome-512.png
echo ""
echo "Осталось: загрузить эти 5 файлов на хостинг в папку с index.html"
