import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css";

const appWindow = getCurrentWindow();

function App() {
    const [inputText, setInputText] = useState("");
    const [translatedText, setTranslatedText] = useState("");

    const [sourceLang, setSourceLang] = useState("English");
    const [targetLang, setTargetLang] = useState("Japanese");
    const [isTranslating, setIsTranslating] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [modelId, setModelId] = useState("balanced"); // Default to Balanced (1.5B)

    const [theme, setTheme] = useState(() => {
        if (typeof window !== "undefined" && window.localStorage) {
            const saved = window.localStorage.getItem("theme");
            if (saved) return saved;
            return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        return "dark";
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    };

    // Auto-unload timer ref
    const unloadTimerRef = useRef<number | null>(null);

    useEffect(() => {
        // Set up event listener for streaming translations
        const unlistenPromise = listen<{ chunk: string; is_last: boolean }>("translation-event", (event) => {
            console.log("📥 Event received:", event.payload.chunk.substring(0, 50), "is_last:", event.payload.is_last);

            // Only update if chunk is not empty
            if (event.payload.chunk) {
                setTranslatedText((prev) => {
                    const newText = prev === "翻訳中..." ? event.payload.chunk : prev + event.payload.chunk;
                    return newText;
                });
            }

            if (event.payload.is_last) {
                setIsTranslating(false);
                // Fallback if translation resulted in no output
                setTranslatedText(prev =>
                    prev === "翻訳中..." ? "翻訳に失敗しました。バックエンドのログを確認してください。" : prev
                );
                console.log("✅ Translation complete");

                // Start auto-unload timer after translation finishes
                resetUnloadTimer();
            }
        });

        // Debug Log Listener
        const unlistenLogPromise = listen<string>("debug-log", (event) => {
            console.log("🛠️ BACKEND LOG:", event.payload);
            if (event.payload.includes("Model loaded successfully")) {
                setModelLoaded(true);
            }
            if (event.payload.includes("Model unloaded")) {
                setModelLoaded(false);
            }
        });

        return () => {
            unlistenPromise.then((unlisten) => unlisten());
            unlistenLogPromise.then((unlisten) => unlisten());
            // Clear timer on unmount
            if (unloadTimerRef.current) clearTimeout(unloadTimerRef.current);
        };
    }, []);

    const resetUnloadTimer = () => {
        if (unloadTimerRef.current) clearTimeout(unloadTimerRef.current);
        // Set new timer for 30 seconds
        // @ts-ignore
        unloadTimerRef.current = setTimeout(async () => {
            console.log("💤 Auto-unloading model to save memory...");
            await invoke("unload_model");
        }, 30000);
    };

    async function handleTranslate() {
        if (!inputText.trim()) return;

        // Clear existing timer when user interacts
        if (unloadTimerRef.current) clearTimeout(unloadTimerRef.current);

        console.log("🚀 Starting translation:", inputText.substring(0, 30));
        try {
            setIsTranslating(true);
            setModelLoaded(true); // Optimistic update, actual update via log
            setTranslatedText("翻訳中...");
            console.log("Calling invoke with:", sourceLang, "→", targetLang, "Model:", modelId);
            await invoke("translate", {
                text: inputText,
                sourceLang,
                targetLang,
                modelId
            });
            console.log("✅ Invoke completed successfully");
        } catch (err) {
            console.error("❌ Translation Error:", err);
            setTranslatedText("エラー: " + err);
            setIsTranslating(false);
            // Even on error, try to unload eventually
            resetUnloadTimer();
        }
    }

    async function handleCancel() {
        if (!isTranslating) return;
        console.log("🛑 Cancelling translation...");
        try {
            await invoke("cancel_translation");
            // We don't set isTranslating(false) here immediately, we wait for the backend to send is_last=true
            // or we could force it if we want immediate feedback, but backend flow handles it.
            // For better UX, we might want to force it or show "Cancelling..." state.
            // For now, let's rely on backend finishing the loop and sending payload.
        } catch (err) {
            console.error("❌ Failed to cancel:", err);
        }
    }

    const [isSwapping, setIsSwapping] = useState(false);

    const handleSwapLanguages = () => {
        setIsSwapping(true);
        setTimeout(() => setIsSwapping(false), 300);

        const temp = sourceLang;
        setSourceLang(targetLang);
        setTargetLang(temp);

        // User requested NOT to swap text. Left is always input, Right is always output.
        // potentially we could re-trigger translation here if the input text fits the new source language,
        // but for now we just swap the labels.
    };

    return (
        <div className="w-full h-full bg-[#f5f7f8] dark:bg-[#101922] font-display flex flex-col overflow-hidden relative group transition-colors duration-300">
            {/* Top Bar */}
            <header data-tauri-drag-region className="h-16 border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-6 bg-white dark:bg-black shrink-0 relative z-10">
                {/* Drag Handler - Removed separate div, now on header */}

                <div className="flex items-center space-x-8 z-10 relative">
                    {/* Source Language */}
                    <button
                        onClick={() => setSourceLang(sourceLang === "English" ? "Japanese" : "English")}
                        className="text-lg font-medium text-gray-900 dark:text-white hover:text-[#258cf4] dark:hover:text-[#258cf4] transition-colors focus:outline-none"
                    >
                        {sourceLang}
                    </button>
                    {/* Swap Button */}
                    <button
                        onClick={handleSwapLanguages}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 dark:text-gray-500 hover:text-[#258cf4] dark:hover:text-[#258cf4] transition-all active:scale-95 group/swap"
                    >
                        <span className={`material-icons text-xl transition-transform duration-300 transform group-hover/swap:scale-110 ${isSwapping ? "rotate-180 text-[#258cf4]" : ""}`}>swap_horiz</span>
                    </button>
                    {/* Target Language */}
                    <button
                        onClick={() => setTargetLang(targetLang === "Japanese" ? "English" : "Japanese")}
                        className="text-lg font-medium text-gray-900 dark:text-white hover:text-[#258cf4] dark:hover:text-[#258cf4] transition-colors focus:outline-none"
                    >
                        {targetLang}
                    </button>
                </div>

                {/* Window Controls */}
                <div className="flex gap-4 z-10 relative items-center">
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors relative overflow-hidden w-9 h-9 flex items-center justify-center"
                        title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                        {/* Sun Icon (Show in Light Mode) */}
                        <span
                            className={`material-icons text-[20px] absolute transition-all duration-500 ease-in-out transform ${theme === "light"
                                ? "rotate-0 scale-100 opacity-100"
                                : "rotate-90 scale-0 opacity-0"
                                }`}
                        >
                            light_mode
                        </span>

                        {/* Moon Icon (Show in Dark Mode) */}
                        <span
                            className={`material-icons text-[20px] absolute transition-all duration-500 ease-in-out transform ${theme === "dark"
                                ? "rotate-0 scale-100 opacity-100"
                                : "-rotate-90 scale-0 opacity-0"
                                }`}
                        >
                            dark_mode
                        </span>
                    </button>

                    {/* Model Dropdown */}
                    <div className="relative group/model">
                        <select
                            value={modelId}
                            onChange={(e) => setModelId(e.target.value)}
                            className="appearance-none bg-transparent hover:bg-gray-100 dark:hover:bg-white/10 rounded px-2 py-1 pr-6 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer focus:outline-none transition-colors"
                        >
                            <option value="light">Light (Fast)</option>
                            <option value="balanced">Balanced</option>
                            <option value="high">High Quality</option>
                        </select>
                        <span className="material-icons absolute right-1 top-1/2 -translate-y-1/2 text-[14px] text-gray-400 pointer-events-none group-hover/model:text-gray-600 dark:group-hover/model:text-white transition-colors">expand_more</span>
                    </div>

                    <div className="w-px h-4 bg-gray-300 dark:bg-white/20"></div>

                    <div className="flex gap-2 opacity-50 hover:opacity-100 transition-opacity duration-200">
                        <div
                            onClick={() => appWindow.minimize()}
                            className="w-3 h-3 rounded-full bg-gray-300 dark:bg-white/20 hover:bg-gray-400 dark:hover:bg-white/40 cursor-pointer transition-colors"
                            title="Minimize"
                        ></div>
                        <div
                            onClick={() => appWindow.toggleMaximize()}
                            className="w-3 h-3 rounded-full bg-gray-300 dark:bg-white/20 hover:bg-gray-400 dark:hover:bg-white/40 cursor-pointer transition-colors"
                            title="Maximize"
                        ></div>
                        <div
                            onClick={() => appWindow.close()}
                            className="w-3 h-3 rounded-full bg-[#258cf4]/80 hover:bg-[#e81123] cursor-pointer transition-colors"
                            title="Close"
                        ></div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
                {/* Input Area (Left) */}
                <div className="flex-1 relative group/input flex flex-col">
                    <textarea
                        className="w-full h-full p-8 bg-transparent border-none text-2xl md:text-3xl text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:ring-0 leading-relaxed font-light outline-none resize-none"
                        placeholder="Enter text to translate... (Ctrl+Enter)"
                        spellCheck={false}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                handleTranslate();
                            }
                        }}
                    />
                    {/* Character Count */}
                    <div className="absolute bottom-4 left-6 text-xs text-gray-400 dark:text-gray-600 opacity-0 group-focus-within/input:opacity-100 transition-opacity pointer-events-none">
                        {inputText.length} / 5000
                    </div>
                </div>

                {/* Vertical Divider */}
                <div className="w-full h-px md:w-px md:h-full bg-gray-200 dark:bg-white/10 shrink-0"></div>

                {/* Output Area (Right) */}
                <div className="flex-1 relative bg-gray-50 dark:bg-white/[0.02] group/output flex flex-col">
                    {/* Result Display */}
                    <div className="w-full h-full p-8 overflow-y-auto">
                        <p className="text-2xl md:text-3xl text-gray-900 dark:text-white leading-relaxed font-light whitespace-pre-wrap">
                            {translatedText || (
                                <span className="text-gray-400 dark:text-gray-500 font-display text-base">
                                    {isTranslating ? "Translating..." : "(Translation will appear here instantly)"}
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Action Floating Buttons */}
                    <div className="absolute bottom-6 right-6 flex gap-4 z-50">
                        {/* Translate / Stop Button */}
                        <button
                            onClick={isTranslating ? handleCancel : handleTranslate}
                            disabled={!isTranslating && !inputText.trim()}
                            aria-label={isTranslating ? "Stop Translation" : "Translate"}
                            className={`w-12 h-12 flex items-center justify-center rounded-full border shadow-lg transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90 hover:-translate-y-1 ${isTranslating
                                ? "bg-red-500 border-red-500 text-white hover:bg-red-600 hover:shadow-red-500/30"
                                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-400 hover:text-[#258cf4] dark:hover:text-[#258cf4] hover:border-[#258cf4] dark:hover:border-[#258cf4] hover:shadow-blue-500/10"
                                } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100`}
                        >
                            <span className={`material-icons text-xl transition-transform duration-300 ${isTranslating ? "animate-pulse" : ""}`}>
                                {isTranslating ? "stop" : "translate"}
                            </span>
                        </button>

                        {/* Copy Button (Primary Action) */}
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(translatedText);
                                // Trigger animation/state logic could be added here if needed, 
                                // but the active state handles the feedback well for now.
                            }}
                            aria-label="Copy Translation"
                            className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-[#258cf4] dark:hover:bg-[#258cf4] hover:text-white dark:hover:text-white transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] shadow-lg hover:shadow-blue-500/30 hover:-translate-y-1 active:scale-90 group/copy relative overflow-hidden"
                        >
                            <span className="material-icons text-xl absolute transition-all duration-300 rotate-0 scale-100 group-active/copy:rotate-90 group-active/copy:scale-0 group-active/copy:opacity-0">content_copy</span>
                            <span className="material-icons text-xl absolute transition-all duration-300 -rotate-90 scale-0 opacity-0 group-active/copy:rotate-0 group-active/copy:scale-100 group-active/copy:opacity-100">check</span>
                        </button>
                    </div>
                </div>
            </main>

            {/* Status Bar (Very Minimal) */}
            <footer className="h-8 bg-white dark:bg-black border-t border-gray-200 dark:border-white/10 flex items-center justify-between px-4 text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-600 shrink-0">
                <span>{isTranslating ? "Processing..." : (modelLoaded ? "Model: Ready" : "Model: Sleeping (Low Mem)")}</span>
                <span>Spark v1.0 • {modelId === "balanced" ? "Balanced Mode" : (modelId === "light" ? "Light Mode" : "High Quality Mode")}</span>
            </footer>
        </div>
    );
}

export default App;
