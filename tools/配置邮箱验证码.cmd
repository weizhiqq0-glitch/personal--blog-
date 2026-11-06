@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\configure-email.ps1" %*
