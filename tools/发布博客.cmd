@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\scripts\publish-blog.ps1" %*
