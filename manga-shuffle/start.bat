@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js が見つかりませんでした。
  echo https://nodejs.org/ から LTS 版をインストールしてから、もう一度このファイルを実行してください。
  pause
  exit /b 1
)

echo 漫画シャッフルを起動します。終了するときはこの画面で Ctrl+C を押してください。
node bin\manga-shuffle.js
pause
