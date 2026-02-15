@echo off
cd /d "%~dp0"
set "PATH=C:\Users\takum\.cargo\bin;%PATH%"
set "LIBCLANG_PATH=C:\Program Files\Side Effects Software\Houdini 21.0.596\python311\lib\site-packages-forced\shiboken6_generator"
cd src-tauri
echo Starting build check...
cargo check
