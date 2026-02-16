@echo off
echo ========================================
echo Spark Uninstaller
echo ========================================
echo.
echo This script will clean up the following:
echo - Environment variables (LIBCLANG_PATH, SPARK_MODELS_PATH)
echo - node_modules folder
echo - models folder (AI model files)
echo - Cargo build cache (target folder in src-tauri)
echo.
echo WARNING: This will NOT uninstall:
echo - Node.js
echo - Rust/Cargo
echo - LLVM
echo.
echo Your source code will NOT be deleted.
echo.
choice /C YN /M "Do you want to continue"
if %ERRORLEVEL%==2 (
    echo Uninstall cancelled.
    pause
    exit /b 0
)
echo.

REM ============================================
REM Step 1: Remove Environment Variables
REM ============================================
echo [1/4] Removing environment variables...

if defined LIBCLANG_PATH (
    echo Removing LIBCLANG_PATH...
    reg delete "HKCU\Environment" /F /V LIBCLANG_PATH >nul 2>&1
    if %ERRORLEVEL%==0 (
        echo [OK] LIBCLANG_PATH removed
    ) else (
        echo [WARN] Could not remove LIBCLANG_PATH (may not exist)
    )
) else (
    echo [SKIP] LIBCLANG_PATH not set
)

if defined SPARK_MODELS_PATH (
    echo Removing SPARK_MODELS_PATH...
    reg delete "HKCU\Environment" /F /V SPARK_MODELS_PATH >nul 2>&1
    if %ERRORLEVEL%==0 (
        echo [OK] SPARK_MODELS_PATH removed
    ) else (
        echo [WARN] Could not remove SPARK_MODELS_PATH (may not exist)
    )
) else (
    echo [SKIP] SPARK_MODELS_PATH not set
)
echo.

REM ============================================
REM Step 2: Remove node_modules
REM ============================================
echo [2/4] Removing node_modules...
if exist "node_modules\" (
    echo Deleting node_modules folder...
    rmdir /S /Q "node_modules"
    if %ERRORLEVEL%==0 (
        echo [OK] node_modules removed
    ) else (
        echo [WARN] Failed to remove node_modules
    )
) else (
    echo [SKIP] node_modules not found
)
echo.

REM ============================================
REM Step 3: Remove models folder
REM ============================================
echo [3/4] Removing models folder...
if exist "models\" (
    echo Deleting models folder (this may take a while)...
    rmdir /S /Q "models"
    if %ERRORLEVEL%==0 (
        echo [OK] models folder removed
    ) else (
        echo [WARN] Failed to remove models folder
    )
) else (
    echo [SKIP] models folder not found
)
echo.

REM ============================================
REM Step 4: Remove Cargo build cache
REM ============================================
echo [4/4] Removing Cargo build cache...
if exist "src-tauri\target\" (
    echo Deleting target folder...
    rmdir /S /Q "src-tauri\target"
    if %ERRORLEVEL%==0 (
        echo [OK] target folder removed
    ) else (
        echo [WARN] Failed to remove target folder
    )
) else (
    echo [SKIP] target folder not found
)
echo.

REM ============================================
REM Summary
REM ============================================
echo ========================================
echo Uninstall Complete!
echo ========================================
echo.
echo The following have been cleaned up:
echo - Environment variables
echo - node_modules
echo - models folder
echo - Cargo build cache
echo.
echo Your source code remains intact.
echo.
echo To reinstall, run: first_time_setup.bat
echo.
echo IMPORTANT: Restart your command prompt for environment
echo variable changes to take effect.
echo.
echo ========================================
pause
