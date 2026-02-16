@echo off
echo ========================================
echo Spark Model Downloader
echo ========================================
echo.

if not exist "models" (
    echo Creating models directory...
    mkdir models
)

cd models

echo [1/4] Downloading Light Model (Default)...
echo File: qwen2.5-0.5b-instruct-q4_k_m.gguf
echo URL: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf
if exist "qwen2.5-0.5b-instruct-q4_k_m.gguf" (
    echo [SKIP] Already exists.
) else (
    curl -L -o qwen2.5-0.5b-instruct-q4_k_m.gguf https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf
)
echo.

echo [2/4] Downloading Nano Model...
echo File: qwen2.5-0.5b-instruct-q2_k.gguf
echo URL: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q2_k.gguf
if exist "qwen2.5-0.5b-instruct-q2_k.gguf" (
    echo [SKIP] Already exists.
) else (
    curl -L -o qwen2.5-0.5b-instruct-q2_k.gguf https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q2_k.gguf
)
echo.

echo [3/4] Downloading Balanced Model...
echo File: qwen2.5-1.5b-instruct-q4_k_m.gguf
echo URL: https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf
if exist "qwen2.5-1.5b-instruct-q4_k_m.gguf" (
    echo [SKIP] Already exists.
) else (
    curl -L -o qwen2.5-1.5b-instruct-q4_k_m.gguf https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf
)
echo.

echo [4/4] Downloading High Quality Model (Qwen 2.5 3B)...
echo File: qwen2.5-3b-instruct-q4_k_m.gguf
echo URL: https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf

REM Remove corrupted/old model if exists
if exist "gemma-2-2b-jpn-it-Q4_K_M.gguf" (
    echo Removing old/corrupted model...
    del "gemma-2-2b-jpn-it-Q4_K_M.gguf"
)

if exist "qwen2.5-3b-instruct-q4_k_m.gguf" (
    echo [SKIP] Already exists.
) else (
    curl -L -o qwen2.5-3b-instruct-q4_k_m.gguf https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf
)
echo.

echo ========================================
echo Download Complete!
echo Models are saved in: %CD%
echo.
echo You can now run setup.bat to verify, or start_spark.bat to launch.
echo ========================================
pause
