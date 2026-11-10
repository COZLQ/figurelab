@echo off
setlocal
cd /d "%~dp0"
set "FIGURELAB_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "FIGURELAB_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)
if not exist "node_modules\next\dist\bin\next" (
  echo Dependencies are missing. Run pnpm install in this folder first.
  pause
  exit /b 1
)
echo FigureLab: http://127.0.0.1:3000
echo Keep this window open while using the editor. Press Ctrl+C to stop.
"%FIGURELAB_NODE%" "node_modules\next\dist\bin\next" dev --hostname 127.0.0.1 --port 3000
