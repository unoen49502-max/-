#!/bin/bash
# macOS: このファイルをダブルクリックすると起動する。
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js が見つかりませんでした。"
  echo "https://nodejs.org/ から LTS 版をインストールしてから、もう一度このファイルを実行してください。"
  read -r -p "Enter キーで閉じます"
  exit 1
fi

echo "漫画シャッフルを起動します。終了するときは Ctrl+C を押してください。"
node bin/manga-shuffle.js
