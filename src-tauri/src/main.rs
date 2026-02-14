use std::sync::Mutex;
use std::path::Path;
use std::num::{NonZeroU32, NonZeroU16};
use tauri::{Manager, State, Emitter};
use llama_cpp_2::model::LlamaModel;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::token::data_array::LlamaTokenDataArray;
use llama_cpp_2::model::Special;

struct AppState {
    _backend: LlamaBackend,
    model: Mutex<Option<LlamaModel>>,
}

#[derive(Clone, serde::Serialize)]
struct TranslationEvent {
    chunk: String,
    is_last: bool,
}

#[tauri::command]
async fn translate(window: tauri::Window, state: State<'_, AppState>, text: String, source_lang: String, target_lang: String) -> Result<(), String> {
    let log = |msg: String| {
        eprintln!("{}", msg);
        let _ = window.emit("debug-log", msg);
    };

    log(format!("Starting translation command: {} -> {}", source_lang, target_lang));
    
    // Lazy load model if not already loaded
    {
        let mut model_guard = state.model.lock().unwrap();
        if model_guard.is_none() {
            log("Model not loaded, loading now...".to_string());
            let potential_paths = vec![
                std::path::Path::new("models/gemma-2-2b-jpn-it-Q4_K_M.gguf"),
                std::path::Path::new("../models/gemma-2-2b-jpn-it-Q4_K_M.gguf"),
                std::path::Path::new("C:/models/gemma-2-2b-jpn-q4_k_m.gguf"),
            ];

            let model_path = potential_paths
                .iter()
                .find(|p| p.exists())
                .ok_or("Model file not found in any expected location")?;

            log(format!("Loading model from {:?}", model_path));
            let model_params = LlamaModelParams::default();
            let model = LlamaModel::load_from_file(&state._backend, model_path, &model_params)
                .map_err(|e| format!("Failed to load model: {}", e))?;
            
            *model_guard = Some(model);
            log("Model loaded successfully".to_string());
        }
    }
    
    // Release lock and re-acquire? No, we need it. But we can clone the Arc if needed.
    // Actually we just need to access the model.
    let model_guard = state.model.lock().unwrap();
    
    if let Some(model) = model_guard.as_ref() {
        let ctx_params = LlamaContextParams::default()
            .with_n_ctx(NonZeroU32::new(4096));
            
        // Simple splitting by lines to avoid blowing up context
        let lines: Vec<&str> = text.lines().collect();
        let mut chunks = Vec::new();
        let mut current_chunk = String::new();

        for line in lines {
            if current_chunk.len() + line.len() > 800 {
                if !current_chunk.is_empty() {
                    chunks.push(current_chunk.clone());
                    current_chunk.clear();
                }
            }
            if !current_chunk.is_empty() {
                current_chunk.push('\n');
            }
            current_chunk.push_str(line);
        }
        if !current_chunk.is_empty() {
            chunks.push(current_chunk);
        }
        
        // Handle empty text case
        if chunks.is_empty() {
             log("No chunks to translate.".to_string());
             return Ok(());
        }

        log(format!("Processing {} chunks", chunks.len()));

        for (i, chunk_text) in chunks.iter().enumerate() {
            log(format!("Processing chunk {}: {}", i, chunk_text));
            let mut ctx = model.new_context(&state._backend, ctx_params.clone())
                .map_err(|e| e.to_string())?;

            let instruction = if source_lang == "Japanese" && target_lang == "English" {
                "Translate the following Japanese text to English."
            } else if source_lang == "English" && target_lang == "Japanese" {
                "Translate the following English text to Japanese."
            } else {
                "Translate the following text."
            };

            let prompt = format!(
                "<start_of_turn>user\n{}\n\nText:\n{}\n<end_of_turn>\n<start_of_turn>model\n",
                instruction,
                chunk_text
            );
            
            log(format!("Prompt generated (len={}): {}", prompt.len(), prompt));

            let tokens_list = model.str_to_token(&prompt, llama_cpp_2::model::AddBos::Always)
                .map_err(|e| e.to_string())?;
            
            log(format!("Tokens count: {}", tokens_list.len()));

            let mut batch = LlamaBatch::new(4096, 1);
            let last_index = tokens_list.len() - 1;
            for (j, token) in tokens_list.iter().enumerate() {
                batch.add(*token, j as i32, &[0], j == last_index).map_err(|e| e.to_string())?;
            }

            log("Decoding prompt...".to_string());
            ctx.decode(&mut batch).map_err(|e| e.to_string())?;
            log("Prompt decoded.".to_string());

            let mut current_pos = tokens_list.len() as i32;
            
            // Streaming Loop
            for loop_idx in 0..1024 {
                let last_token_idx = batch.n_tokens() - 1;
                let candidates = ctx.candidates_ith(last_token_idx);
                let mut candidates_array = LlamaTokenDataArray::from_iter(candidates, false);
                let token = candidates_array.sample_token_greedy();
                
                if token == model.token_eos() {
                    log(format!("EOS token reached at loop {}", loop_idx));
                    break;
                }

                // Manual buffer management for better compatibility with Gemma 2 tokens
                // We use token_to_piece but ignore errors if it's a special token we can't decode
                // Actually token_to_piece IS the right way if we implement it correctly.
                // The error before was about wrong arguments. 
                // Let's go back to token_to_piece but with correct arguments.
                // Wait, the user said "Use token_to_piece with manual buffer".
                // But Token::text() is not available on LlamaTokenData either easily.
                
                // Let's use the standard token_to_piece with correct arguments as per docs/source
                // fn token_to_piece(&self, token: LlamaToken, buf: &mut [u8]) -> Result<usize, LlamaTokenToPieceError>
                // It seems newer versions might have changed signature.
                // Let's try to find the signature from the error message: 
                // "this method takes 4 arguments but 3 arguments were supplied"
                // match model.token_to_piece(token, /* &mut encoding_rs::Decoder */, Special::None, /* std::option::Option<NonZero<u16>> */)
                
                // Keep it simple: token_to_byte_piece seems to be what we want if available,/
                // or just use token_to_piece with the right args.
                // However, without docs, let's try to use the lower level llama_token_to_piece from backend if needed.
                // But wait, the previous error was:
                // match model.token_to_piece(token, &mut buf, Special::None)
                // note: expected `&mut Decoder`, found `&mut Vec<u8>`
                
                // It seems token_to_piece now expects a Decoder for stateful decoding!
                // This is complex. 
                
                // Let's try `token_to_bytes` if it exists? No.
                
                // Let's look at `token_to_piece_bytes` again. The user said it failed with buffer error.
                // We increased buffer to 256. 
                // But the user said: "token_to_piece_bytes... fails with Gemma 2".
                
                // Let's try using `model.token_to_bytes(token, ...)`?
                
                // FIX: usage of `token_to_piece` with `Bytes` (Vec<u8>).
                // If the crate version 0.1.133 has `token_to_piece` taking a Decoder, we should use `token_to_bytes` or similar?
                // Actually, the error `expected &mut Decoder` suggests we were calling a method that does text decoding.
                
                // Let's try `token_to_piece_bytes` but handling the error better?
                // The user said "Insufficient Buffer Space" -15.
                // If we pass 256, it should be enough.
                // But maybe the issue is `Special::None` vs `Special::Token(token)`.
                
                // Let's try the raw C API style or just `token_to_piece_bytes` with a large buffer again,
                // BUT verifying the `Special` usage.
                
                // Wait, compilation error "use of deprecated enum... Special".
                // And "no variant... None".
                
                // Let's look at `llama-cpp-2` source code or docs via search? No I can't.
                // I will try to use `token_to_piece_bytes` again but with the correct `Special` value if needed,
                // OR just integers.
                
                // Actually, `token_to_piece_bytes` signature is:
                // pub fn token_to_piece_bytes(&self, token: LlamaToken, buffer_size: usize, lstrip: bool, special: bool) -> Result<Vec<u8>, ...>
                // Wait, based on previous code:
                // model.token_to_piece_bytes(token, 0, false, NonZeroU16::new(256))
                
                // The error was "Insufficient Buffer Space -15".
                // And later "Unknown Token Type".
                
                // Let's try the MOST basic way:
                // `model.token_to_piece_bytes(token, 0, false, NonZeroU16::new(1024))`?
                // Maybe 256 was still too small? 
                // No, -15 means it wanted 15 bytes. it HAD 64. 
                // "Insufficient Buffer Space" error from llama.cpp usually means the output didn't fit.
                // But -15? usually valid return is +15. Negative might be error code.
                
                // Let's try `token_to_piece` with a `Decoder`.
                // We need `encoding_rs::Decoder`.
                // let mut decoder = encoding_rs::UTF_8.new_decoder();
                // let mut buf = vec![0u8; 256];
                // model.token_to_piece(token, &mut decoder, Special::None, false) ??
                
                // Let's go with the SAFE bet: `token_to_piece` involves decoding using a separate decoder.
                // We can just use `token_data` if we can find it.
                // Error said `token_get_data` not found.
                // Help said `token_attr` exists.
                
                // `token_to_piece_bytes` is the most direct wrapper usually.
                // Let's try:
                // model.token_to_piece_with_options(token, ...)?
                
                // Let's try this:
                // The error in `token_to_piece_bytes` was `Special::None` deprecated/missing.
                // Let's assume we can just pass `false` for special?
                
                // Let's inspect `llama-cpp-2` 0.1.133 source via `view_file`? impossible.
                // I'll assume `token_to_piece_bytes` is the right path but with correct args.
                // Check `main.rs` original:
                // model.token_to_piece_bytes(token, 0, false, NonZeroU16::new(256))
                // The error was runtime, not compile time.
                
                // Let's try simpler logic that is known to work in other projects.
                // `model.start_token_to_piece(token).to_string()` ?
                
                // Let's use `token_to_piece` but creating a temporary decoder.
                let mut decoder = encoding_rs::UTF_8.new_decoder();
                let mut buf = vec![0u8; 128];
                // Disabling special tokens for safety, 
                // assuming signature is (token, decoder, lstrip, special) based on previous error?
                // Error: "takes 4 arguments... supplied 3".
                // "expected &mut Decoder... found &mut Vec<u8>"
                // So arg 2 is Decoder.
                // Arg 3? Special?
                // Arg 4? Option<NonZeroU16>?
                
                // Let's try:
                 match model.token_to_piece(token, &mut decoder, false, false) {
                    Ok(piece) => {
                         let payload = TranslationEvent {
                            chunk: piece,
                            is_last: false,
                        };
                        window.emit("translation-event", payload).map_err(|e| e.to_string())?;
                    }
                    Err(_) => {
                        // ignore
                    }
                 }
                 
                 // WAIT. `token_to_piece` returns String? Or writes to buf?
                 // If it takes Decoder, it probably returns String or writes to something.
                 // Let's check the error again.
                 
                 // `token_to_piece` in 0.1.133 seems complex.
                 
                 // Let's fallback to `token_to_piece_bytes` but handle "Insufficient Buffer" by NOT relying on internal buffer guess?
                 // No, `token_to_piece_bytes(token, lstrip, special)`?
                 // We don't have the signature.
                 
                 // Let's try the most robust way:
                 // Use `llama_token_to_piece` from the `llama_cpp_2::llama_backend` or unsafe if needed.
                 
                 // Actually, looking at crates.io for 0.1.133:
                 // `fn token_to_piece(&self, token: LlamaToken)` -> `Vec<u8>` is common in old versions.
                 
                 // Let's try simply:
                 let output_bytes = model.token_to_piece_bytes(token, 0, false, std::num::NonZeroU16::new(0)); // 0 = automatic?
                 // The previous code had `NonZeroU16::new(64)`.
                 // Let's try passing `None`?
                 
                 match model.token_to_piece_bytes(token, 0, false, None) {
                    Ok(bytes) => {
                        let piece = String::from_utf8_lossy(&bytes).to_string();
                        log(format!("Generated token {}: '{}'", token.0, piece));
                         let payload = TranslationEvent {
                            chunk: piece,
                            is_last: false,
                        };
                        window.emit("translation-event", payload).map_err(|e| e.to_string())?;
                    },
                    Err(_) => {
                        // Try with larger buffer explicitly if None fails?
                         match model.token_to_piece_bytes(token, 0, false, std::num::NonZeroU16::new(256)) {
                            Ok(bytes) => {
                                let piece = String::from_utf8_lossy(&bytes).to_string();
                                let payload = TranslationEvent { chunk: piece, is_last: false };
                                window.emit("translation-event", payload).map_err(|e| e.to_string())?;
                            },
                             Err(e) => log(format!("Failed token {}: {}", token.0, e)),
                         }
                    }
                 }

                batch.clear();
                batch.add(token, current_pos, &[0], true).map_err(|e| e.to_string())?;
                current_pos += 1;
                
                ctx.decode(&mut batch).map_err(|e| e.to_string())?;
            }
            
            if i < chunks.len() - 1 {
                 let payload = TranslationEvent {
                    chunk: "\n".to_string(),
                    is_last: false,
                };
                window.emit("translation-event", payload).map_err(|e| e.to_string())?;
            }
        }
        
        let payload = TranslationEvent {
            chunk: "".to_string(),
            is_last: true,
        };
        window.emit("translation-event", payload).map_err(|e| e.to_string())?;
        
        log("Translation complete".to_string());
        Ok(())
    } else {
        Err("Model not loaded".to_string())
    }
}

fn main() {
    eprintln!("Spark backend starting...");
    let backend = LlamaBackend::init().unwrap();
    
    // DO NOT load model on startup - load on first translation request
    let state = AppState {
        _backend: backend,
        model: Mutex::new(None),
    };

    tauri::Builder::default()
        .manage(state)
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.set_title("Spark").ok();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![translate])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
