@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\deploy-free-backend.ps1" %*
