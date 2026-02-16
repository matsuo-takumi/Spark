@echo off
echo ========================================
echo Spark - Complete Setup
echo ========================================
echo.
echo This script will:
echo 1. Check system requirements (Node.js, Rust, LLVM)
echo 2. Install missing dependencies (LLVM, npm packages)
echo 3. Verify everything is ready
echo.

REM ============================================
REM Step 1: Check Node.js
REM ============================================
echo [Step 1/6] Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [MISSING] Node.js is not installed.
    echo.
    echo Please install Node.js first:
    echo 1. Visit: https://nodejs.org/
    echo 2. Download and install the LTS version
    echo 3. Restart this script after installation
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do echo [OK] Node.js %%i installed
)
echo.

REM ============================================
REM Step 2: Check Rust
REM ============================================
echo [Step 2/6] Checking Rust...
where cargo >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [MISSING] Rust is not installed.
    echo.
    echo Please install Rust first:
    echo 1. Visit: https://rustup.rs/
    echo 2. Download and run rustup-init.exe
    echo 3. Restart this script after installation
    echo.
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('cargo --version') do echo [OK] %%i installed
)
echo.

REM ============================================
REM Step 3: Check/Install LLVM
REM ============================================
echo [Step 3/6] Checking LLVM/libclang...

if exist "C:\Program Files\LLVM\bin\libclang.dll" (
    echo [OK] LLVM found at: C:\Program Files\LLVM\bin
    goto :LLVM_DONE
)
if exist "C:\Program Files (x86)\LLVM\bin\libclang.dll" (
    echo [OK] LLVM found at: C:\Program Files (x86)\LLVM\bin
    goto :LLVM_DONE
)
if defined LIBCLANG_PATH (
    if exist "%LIBCLANG_PATH%\libclang.dll" (
        echo [OK] LLVM found at: %LIBCLANG_PATH%
        goto :LLVM_DONE
    )
)

echo [MISSING] LLVM is not installed
echo.
echo Checking if winget is available...
where winget >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] winget is not available.
    echo.
    echo Please install LLVM manually:
    echo 1. Visit: https://github.com/llvm/llvm-project/releases
    echo 2. Download the latest LLVM Windows installer
    echo 3. Run the installer
    echo 4. Restart this script
    echo.
    exit /b 1
)

echo Installing LLVM via winget (this may take several minutes)...
winget install LLVM.LLVM --silent --accept-package-agreements --accept-source-agreements

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] LLVM installation failed.
    echo Please try installing manually from: https://github.com/llvm/llvm-project/releases
    exit /b 1
)

echo.
echo [OK] LLVM installed successfully
echo Note: LIBCLANG_PATH will be set automatically when running start_spark.bat

:LLVM_DONE
echo.

REM ============================================
REM Step 4: Install npm dependencies
REM ============================================
echo [Step 4/6] Installing npm dependencies...
if exist "node_modules\" (
    echo [SKIP] node_modules already exists
) else (
    echo Installing packages...
    cmd /c npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
)
echo.

REM ============================================
REM Step 5: Check Models
REM ============================================
echo [Step 5/6] Checking AI models...

set MODELS_FOUND=0
if exist "models\qwen2.5-0.5b-instruct-q4_k_m.gguf" (
    echo [OK] Models already downloaded
    set MODELS_FOUND=1
) else if exist "models\qwen2.5-3b-instruct-q4_k_m.gguf" (
    echo [OK] High Quality model already downloaded
    set MODELS_FOUND=1
)

if %MODELS_FOUND%==0 (
    echo [SKIP] AI models not found
    echo       You can download models later by running: download_models.bat
)
echo.

REM ============================================
REM Step 6: Final Verification
REM ============================================
echo [Step 6/6] Final verification...
echo.

set FINAL_ERROR=0

REM Verify Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] Node.js check failed
    set FINAL_ERROR=1
) else (
    echo [OK] Node.js ready
)

REM Verify Rust
where cargo >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] Rust check failed
    set FINAL_ERROR=1
) else (
    echo [OK] Rust ready
)

REM Verify LLVM
set LLVM_VERIFIED=0
if exist "C:\Program Files\LLVM\bin\libclang.dll" set LLVM_VERIFIED=1
if exist "C:\Program Files (x86)\LLVM\bin\libclang.dll" set LLVM_VERIFIED=1
if defined LIBCLANG_PATH (
    if exist "%LIBCLANG_PATH%\libclang.dll" set LLVM_VERIFIED=1
)

if %LLVM_VERIFIED%==1 (
    echo [OK] LLVM ready
) else (
    echo [FAIL] LLVM not found
    set FINAL_ERROR=1
)

REM Verify npm dependencies
if exist "node_modules\" (
    echo [OK] npm dependencies ready
) else (
    echo [FAIL] node_modules not found
    set FINAL_ERROR=1
)

echo.
echo ========================================
if %FINAL_ERROR%==1 (
    echo Setup FAILED - Please fix the errors above
    echo ========================================
    exit /b 1
) else (
    echo Setup Complete!
    echo ========================================
    echo.
    echo All dependencies are installed and configured.
    echo.
    echo Next steps:
    echo 1. If you haven't downloaded models: run download_models.bat
    echo 2. To start the app: run start_spark.bat
    echo.
    echo ========================================
    exit /b 0
)
