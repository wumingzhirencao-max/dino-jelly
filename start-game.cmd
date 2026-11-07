@echo off
title Dino Jelly 本地服务
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 没找到 node，请先安装 Node.js，或直接双击 index.html 用浏览器打开。
  pause
  exit /b 1
)
echo 正在启动本地服务： http://127.0.0.1:8795/
echo 关掉这个黑窗口就会停止服务。
start "" http://127.0.0.1:8795/
node serve.cjs
