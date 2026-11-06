@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-blog.ps1" %*
