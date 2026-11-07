@echo off
title Dino Jelly 本地服务
cd /d "%~dp0"
echo 正在启动本地服务： http://127.0.0.1:8795/
echo 关掉这个黑窗口就会停止服务。
start "" http://127.0.0.1:8795/
"E:\Nodejs\node.exe" serve.cjs
