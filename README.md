# Spark - Local Translation Application

Sparkは、ローカルで動作するAI翻訳アプリケーションです。LLMモデル（llama-cpp-2）を使用して、プライバシーを保護しながらテキストを翻訳できます。

## システム要件

- **Node.js** (v18以上推奨)
- **Rust** (最新安定版)
- **npm** (Node.jsに含まれています)
- **LLVM/Clang** (libclang.dllが必要 - ビルド時に使用)
- **Windows** (現在Windows専用)

## セットアップ手順

### 1. 依存関係のインストール

#### Node.jsとnpmのインストール
[Node.js公式サイト](https://nodejs.org/)から最新のLTSバージョンをダウンロードしてインストールしてください。

#### Rustのインストール
[Rust公式サイト](https://www.rust-lang.org/tools/install)から`rustup`をダウンロードして実行してください。

#### LLVM/Clangのインストール（重要！）

Sparkのビルドには**LLVM（libclang）**が必要です。

**自動インストール（推奨）:**
```bash
install_llvm.bat
```

このスクリプトは：
- wingetを使用してLLVMをインストール
- LIBCLANG_PATH環境変数を自動設定
- インストール完了後、コマンドプロンプトを再起動してください

**手動インストール:**
1. [LLVM公式サイト](https://github.com/llvm/llvm-project/releases)から最新版をダウンロード
2. インストーラーを実行（例：`C:\Program Files\LLVM`にインストール）
3. システム環境変数`LIBCLANG_PATH`を設定：
   ```
   LIBCLANG_PATH=C:\Program Files\LLVM\bin
   ```

インストール後、コマンドプロンプトで確認：
```bash
node --version
npm --version
cargo --version
echo %LIBCLANG_PATH%
```

### 2. モデルファイルの準備

Sparkは以下のGGUFモデルファイルを必要とします：

| モデルID | ファイル名 | 説明 |
|---------|-----------|------|
| light (デフォルト) | `qwen2.5-0.5b-instruct-q4_k_m.gguf` | 軽量・高速 |
| nano | `qwen2.5-0.5b-instruct-q2_k.gguf` | 超軽量 |
| balanced | `qwen2.5-1.5b-instruct-q4_k_m.gguf` | バランス型 |
| high | `gemma-2-2b-jpn-it-Q4_K_M.gguf` | 高品質（日本語特化） |

#### モデルファイルの配置方法

**方法1: 推奨 - 環境変数を使用**

1. モデルファイルを任意のフォルダに配置（例：`D:\AI\Models\`）
2. システム環境変数 `SPARK_MODELS_PATH` を設定：
   ```
   SPARK_MODELS_PATH=D:\AI\Models
   ```
   
   環境変数の設定方法：
   - Windowsキー → 「環境変数」で検索 → 「システム環境変数の編集」
   - 「環境変数」ボタンをクリック
   - 「新規」で `SPARK_MODELS_PATH` を作成し、モデルフォルダのパスを指定

**方法2: デフォルトパスに配置**

環境変数を設定しない場合、以下の場所から自動検索されます：
- `x:\Models\`
- `models\` (プロジェクトフォルダ内)
- `..\models\` (プロジェクトの親フォルダ)
- `C:\models\`

### 3. プロジェクトのセットアップ

プロジェクトフォルダで以下を実行：

```bash
npm install
```

### 4. アプリケーションの起動

```bash
start_spark.bat
```

または

```bash
npm run tauri dev
```

## トラブルシューティング

### モデルファイルが見つからないエラー

エラーメッセージに検索されたパスが表示されます。以下を確認してください：

1. モデルファイルが存在するか
2. ファイル名が正確に一致しているか
3. `SPARK_MODELS_PATH` 環境変数が正しく設定されているか
4. 環境変数を設定した後、コマンドプロンプトを再起動したか

### Cargoが見つからないエラー

Rustが正しくインストールされているか確認：
```bash
cargo --version
```

インストールされていない場合は、[Rust公式サイト](https://www.rust-lang.org/tools/install)からインストールしてください。

### libclangが見つからないエラー

ビルド時に「Unable to find libclang」エラーが出る場合：

1. **LLVMがインストールされているか確認:**
   ```bash
   echo %LIBCLANG_PATH%
   ```
   
2. **未設定の場合、install_llvm.batを実行:**
   ```bash
   install_llvm.bat
   ```

3. **手動で設定する場合:**
   ```bash
   setx LIBCLANG_PATH "C:\Program Files\LLVM\bin"
   ```
   
4. **重要:** 環境変数設定後は**必ずコマンドプロンプトを再起動**してください。

### ポート1420が使用中

`start_spark.bat` を使用すると、既存のプロセスを自動的に終了してから起動します。手動で起動する場合は：

```bash
# ポートを使用しているプロセスを終了
powershell -Command "Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }"
```

## 開発者向け

### Rustコードのチェック

```bash
check_rust.bat
```

または

```bash
cd src-tauri
cargo check
```

### ビルド

```bash
build_spark.bat
```

または

```bash
npm run tauri build
```

## 使い方

1. アプリケーションを起動
2. Ctrl+C を2回連続で押すと、クリップボードのテキストが翻訳されるポップアップが表示されます
3. メインウィンドウでは詳細な翻訳設定が可能です

## ライセンス

このプロジェクトは個人使用を目的としています。
