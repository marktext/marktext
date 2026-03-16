@echo off
rem Build a Windows NSIS installer for x64.
setlocal

pushd "%~dp0\.." >nul 2>&1
if errorlevel 1 exit /b %errorlevel%

call node .electron-vue/build.js
if errorlevel 1 (
  set "exit_code=%errorlevel%"
  popd
  exit /b %exit_code%
)

call .\node_modules\.bin\electron-builder.cmd --win nsis --x64
set "exit_code=%errorlevel%"
popd
exit /b %exit_code%
