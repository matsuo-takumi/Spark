@echo off
cd /d "%~dp0"

REM Auto-detect LIBCLANG_PATH if not set
if not defined LIBCLANG_PATH (
    if exist "C:\Program Files\LLVM\bin\libclang.dll" (
        set "LIBCLANG_PATH=C:\Program Files\LLVM\bin"
    ) else if exist "C:\Program Files (x86)\LLVM\bin\libclang.dll" (
        set "LIBCLANG_PATH=C:\Program Files (x86)\LLVM\bin"
    )
)

echo Killing process on port 1420...
powershell -Command "Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }"
echo Killing spark.exe...
taskkill /F /IM spark.exe /T 2>nul
echo Starting Spark...
npm run tauri dev
