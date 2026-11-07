@echo off
cd /d "%~dp0.."
node --use-env-proxy scripts\folia-preview.cjs
pause
