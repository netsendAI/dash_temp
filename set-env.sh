#!/bin/bash
# Скрипт для переключения favicon между локальной и GitHub версиями

HTML_FILE="index.html"

case "$1" in
    local|l)
        sed -i '' 's/href="favicon-github.svg"/href="favicon-local.svg"/' "$HTML_FILE"
        echo "Установлена локальная версия (синяя L)"
        ;;
    github|g)
        sed -i '' 's/href="favicon-local.svg"/href="favicon-github.svg"/' "$HTML_FILE"
        echo "Установлена GitHub версия (зелёная G)"
        ;;
    *)
        echo "Использование: $0 {local|github}"
        echo ""
        echo "  local   - синяя иконка с буквой L (для локальной разработки)"
        echo "  github  - зелёная иконка с буквой G (для публикации на GitHub)"
        exit 1
        ;;
esac
