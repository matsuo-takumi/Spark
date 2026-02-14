@echo off
set "PATH=C:\Users\takum\.cargo\bin;%PATH%"
echo Initializing Spark project...
npx -y create-tauri-app@latest . --manager npm --template react-ts --y
