#Requires -Version 5.1
<#
.SYNOPSIS
    Скрипт сборки MarkText для Windows
.DESCRIPTION
    Устанавливает зависимости и собирает exe-файл MarkText
.NOTES
    Запуск: .\build-win.ps1
#>

$ErrorActionPreference = "Stop"

function Write-Step($step, $total, $message) {
    Write-Host ""
    Write-Host "[STEP $step/$total] $message" -ForegroundColor Cyan
}

function Write-Success($message) {
    Write-Host "[OK] $message" -ForegroundColor Green
}

function Write-Error($message) {
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

function Write-Info($message) {
    Write-Host "[INFO] $message" -ForegroundColor Yellow
}

# Заголовок
Write-Host ""
Write-Host "============================================" -ForegroundColor White
Write-Host "   MarkText - Windows Build Script" -ForegroundColor White
Write-Host "============================================" -ForegroundColor White
Write-Host ""

# Проверка Node.js
Write-Info "Проверка Node.js..."
try {
    $nodeVersion = node --version
    Write-Success "Node.js $nodeVersion"
} catch {
    Write-Error "Node.js не найден. Установите Node.js >= 20.19.0"
    Write-Host "Скачать: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Проверка pnpm
Write-Info "Проверка pnpm..."
try {
    $pnpmVersion = pnpm --version
    Write-Success "pnpm $pnpmVersion"
} catch {
    Write-Info "pnpm не найден. Устанавливаю..."
    npm install -g pnpm
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Не удалось установить pnpm"
        exit 1
    }
    Write-Success "pnpm установлен"
}

Write-Host ""

# Шаг 1: Установка зависимостей
Write-Step 1 3 "Установка зависимостей..."
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "Ошибка при установке зависимостей"
    exit 1
}
Write-Success "Зависимости установлены"

# Шаг 2: Сборка
Write-Step 2 3 "Сборка проекта..."
pnpm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Ошибка при сборке"
    exit 1
}
Write-Success "Проект собран"

# Шаг 3: Создание exe
Write-Step 3 3 "Создание Windows exe (x64)..."
pnpm run build:win:x64
if ($LASTEXITCODE -ne 0) {
    Write-Error "Ошибка при создании exe"
    exit 1
}
Write-Success "exe-файл создан"

# Результат
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   Готово!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Файлы в папке: dist\" -ForegroundColor White
Write-Host ""
Write-Host "Установочный файл:  dist\marktext-win-x64-*-setup.exe" -ForegroundColor Yellow
Write-Host "Portable версия:    dist\marktext-win-x64-*.zip" -ForegroundColor Yellow
Write-Host ""
