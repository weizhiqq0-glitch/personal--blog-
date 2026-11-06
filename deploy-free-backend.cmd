@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy-free-backend.ps1" %*
