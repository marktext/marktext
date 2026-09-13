@echo off
chcp 866 >nul
title MarkText Build

echo.
echo ============================================
echo   MarkText - Windows Build
echo ============================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found!
    echo Install: https://nodejs.org/
    goto end
)

where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing pnpm...
    call npm install -g pnpm
)

echo.
echo [1/3] Install dependencies...
call pnpm install

echo.
echo [2/3] Build...
call pnpm run build

echo.
echo [3/3] Package for Windows...
call pnpm run build:win:x64

:end
echo.
echo ============================================
echo   DONE. Press any key to close.
echo ============================================
pause
