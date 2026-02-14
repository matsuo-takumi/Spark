use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
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
    current_model_id: Mutex<Option<String>>,
    is_cancelled: AtomicBool,
}

#[derive(Clone, serde::Serialize)]
struct TranslationEvent {
    chunk: String,
    is_last: bool,
}

#[tauri::command]
async fn cancel_translation(window: tauri::Window, state: State<'_, AppState>) -> Result<(), String> {
    state.is_cancelled.store(true, Ordering::Relaxed);
    window.emit("debug-log", "Cancellation requested".to_string()).unwrap_or(());
    Ok(())
}

#[tauri::command]
async fn translate(window: tauri::Window, state: State<'_, AppState>, text: String, source_lang: String, target_lang: String, model_id: String) -> Result<(), String> {
    // Reset cancellation flag
    state.is_cancelled.store(false, Ordering::Relaxed);

    let log = |msg: String| {
        eprintln!("{}", msg);
        let _ = window.emit("debug-log", msg);
    };

    log(format!("Starting translation logic: {} -> {} using model '{}'", source_lang, target_lang, model_id));
    
    // Check if we need to switch models
    let mut should_reload = false;
    {
        let mut current_id_guard = state.current_model_id.lock().unwrap();
        if current_id_guard.as_deref() != Some(&model_id) {
            log(format!("Model switch requested: {:?} -> {}", *current_id_guard, model_id));
            should_reload = true;
            *current_id_guard = Some(model_id.clone());
        }
    }

    // Lazy load model or reload if switched
    {
        let mut model_guard = state.model.lock().unwrap();
        
        if should_reload {
            // Unload previous model first
            if model_guard.is_some() {
                log("Unloading previous model...".to_string());
                *model_guard = None;
            }
        }

        if model_guard.is_none() {
            log(format!("Loading model '{}'...", model_id));
            
            let model_filename = match model_id.as_str() {
                "balanced" => "qwen2.5-1.5b-instruct-q4_k_m.gguf",
                "high" => "gemma-2-2b-jpn-it-Q4_K_M.gguf",
                // Default to light/0.5b for safety or explicit "light"
                _ => "qwen2.5-0.5b-instruct-q4_k_m.gguf", 
            };

            let potential_paths = vec![
                std::path::PathBuf::from(format!("models/{}", model_filename)),
                std::path::PathBuf::from(format!("../models/{}", model_filename)),
                std::path::PathBuf::from(format!("C:/models/{}", model_filename)),
            ];

            let model_path = potential_paths
                .iter()
                .find(|p| p.exists())
                .ok_or(format!("Model file '{}' not found in expected locations", model_filename))?;

            log(format!("Loading model from {:?}", model_path));
            let model_params = LlamaModelParams::default();
            let model = LlamaModel::load_from_file(&state._backend, model_path, &model_params)
                .map_err(|e| format!("Failed to load model: {}", e))?;
            
            *model_guard = Some(model);
            log("Model loaded successfully".to_string());
        }
    }
    
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
            // Check cancellation before processing chunk
            if state.is_cancelled.load(Ordering::Relaxed) {
                log("Translation cancelled by user.".to_string());
                break;
            }

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
            
            // Determine prompt format based on model_id
            let prompt = if model_id == "high" {
                // Gemma Format - Enforce strictness to avoid "context" or reasoning
                let distinct_instruction = format!("{} Output ONLY the translated text. Do not provide any explanations, notes, or context.", instruction);
                format!(
                    "<start_of_turn>user\n{}\n\nText:\n{}\n<end_of_turn>\n<start_of_turn>model\n",
                    distinct_instruction,
                    chunk_text
                )
            } else {
                // Qwen Format (ChatML) - shared by 0.5B and 1.5B
                format!(
                    "<|im_start|>system\nYou are a helpful translator. {}<|im_end|>\n<|im_start|>user\n{}\n<|im_end|>\n<|im_start|>assistant\n",
                    instruction,
                    chunk_text
                )
            };
            
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
                // Check cancellation in generation loop
                if state.is_cancelled.load(Ordering::Relaxed) {
                    log("Translation cancelled by user.".to_string());
                    // Emit cancellation event/message if needed, or just break
                    break;
                }

                let last_token_idx = batch.n_tokens() - 1;
                let candidates = ctx.candidates_ith(last_token_idx);
                let mut candidates_array = LlamaTokenDataArray::from_iter(candidates, false);
                let token = candidates_array.sample_token_greedy();
                
                if token == model.token_eos() {
                    log(format!("EOS token reached at loop {}", loop_idx));
                    break;
                }

                // Manual buffer management for better compatibility with Gemma 2 tokens
                match model.token_to_piece_bytes(token, 1024, false, None) {
                    Ok(bytes) => {
                         let piece = String::from_utf8_lossy(&bytes).to_string();
                         log(format!("Generated token {}: '{}'", token.0, piece));
                         
                         let payload = TranslationEvent {
                            chunk: piece,
                            is_last: false,
                        };
                        window.emit("translation-event", payload).map_err(|e| e.to_string())?;
                    },
                    Err(e) => {
                        // Log errors (e.g. Unknown Token Type) but don't crash
                        log(format!("Failed to convert token {}: {}", token.0, e));
                    }
                }

                batch.clear();
                batch.add(token, current_pos, &[0], true).map_err(|e| e.to_string())?;
                current_pos += 1;
                
                ctx.decode(&mut batch).map_err(|e| e.to_string())?;
            }
            
            // If cancelled, stop processing further chunks
            if state.is_cancelled.load(Ordering::Relaxed) {
                break;
            }

            if i < chunks.len() - 1 {
                 let payload = TranslationEvent {
                    chunk: "\n".to_string(),
                    is_last: false,
                };
                window.emit("translation-event", payload).map_err(|e| e.to_string())?;
            }
        }
        
        // Final event to signal end/cancellation
        let payload = TranslationEvent {
            chunk: "".to_string(),
            is_last: true,
        };
        window.emit("translation-event", payload).map_err(|e| e.to_string())?;
        
        log("Translation complete/cancelled".to_string());
        Ok(())
    } else {
        Err("Model not loaded".to_string())
    }
}

#[tauri::command]
async fn unload_model(window: tauri::Window, state: State<'_, AppState>) -> Result<(), String> {
    let mut model_guard = state.model.lock().unwrap();
    let mut current_id_guard = state.current_model_id.lock().unwrap();
    if model_guard.is_some() {
        *model_guard = None;
        *current_id_guard = None;
        eprintln!("Model unloaded");
        window.emit("debug-log", "Model unloaded manually to save memory".to_string()).unwrap_or(());
        Ok(())
    } else {
        Ok(()) // Already unloaded
    }
}

fn main() {
    eprintln!("Spark backend starting...");
    let backend = LlamaBackend::init().unwrap();
    
    // DO NOT load model on startup - load on first translation request
    let state = AppState {
        _backend: backend,
        model: Mutex::new(None),
        current_model_id: Mutex::new(None),
        is_cancelled: AtomicBool::new(false),
    };

    tauri::Builder::default()
        .manage(state)
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.set_title("Spark").ok();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![translate, unload_model, cancel_translation])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
