import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, emit } from "@tauri-apps/api/event";
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
    const [showModelMenu, setShowModelMenu] = useState(false);
    const modelMenuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
                setShowModelMenu(false);
            }
        };

        if (showModelMenu) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showModelMenu]);

    // Optimization: Use ref for translatedText to avoid re-binding event listeners
    const translatedTextRef = useRef("");
    useEffect(() => {
        translatedTextRef.current = translatedText;
    }, [translatedText]);

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
        emit("theme-changed", theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    };

    const [fontSize, setFontSize] = useState(() => {
        if (typeof window !== "undefined" && window.localStorage) {
            const saved = parseInt(window.localStorage.getItem("fontSize") || "24");
            return isNaN(saved) ? 24 : saved;
        }
        return 24;
    });


    useEffect(() => {
        localStorage.setItem("fontSize", fontSize.toString());
    }, [fontSize]);

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -2 : 2;
                setFontSize(prev => Math.min(Math.max(prev + delta, 12), 72));
            }
        };

        window.addEventListener("wheel", handleWheel, { passive: false });
        return () => window.removeEventListener("wheel", handleWheel);
    }, []);

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

    const [swapRotation, setSwapRotation] = useState(0);

    const handleSwapLanguages = useCallback(() => {
        setSwapRotation(prev => prev === 0 ? 180 : 0);

        setSourceLang(prev => prev === "English" ? "Japanese" : "English");
        setTargetLang(prev => prev === "Japanese" ? "English" : "Japanese");
    }, []);

    const cycleMode = () => {
        const modes = ["nano", "light", "balanced", "high"];
        const currentIndex = modes.indexOf(modelId);
        const nextIndex = (currentIndex + 1) % modes.length;
        const nextMode = modes[nextIndex];
        setModelId(nextMode);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === "Tab") {
                e.preventDefault();
                handleSwapLanguages();
            }
            // Ctrl + Shift + C to Copy
            if (e.ctrlKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault();
                navigator.clipboard.writeText(translatedTextRef.current);
                // Optional: We could trigger a toast notification here if we had one
                console.log("Copied to clipboard via shortcut");
            }
            // Ctrl + M to Cycle Modes
            if (e.ctrlKey && (e.key === 'm' || e.key === 'M')) {
                e.preventDefault();
                cycleMode();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleSwapLanguages, modelId]); // Added modelId because cycleMode depends on it, allow it to re-bind?
    // Actually handleKeyDown is redefined on every render if we don't wrap it or deps change.
    // To avoid stale state, we need modelId in dep array or use functional update.

    return (
        <div className="w-full h-full bg-[#f5f7f8] dark:bg-[#101922] font-display flex flex-col overflow-hidden relative group transition-colors duration-300">
            {/* Top Bar */}
            <header data-tauri-drag-region className="h-16 border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-6 bg-white dark:bg-black shrink-0 relative z-10">
                {/* Drag Handler & Left Side (Empty for now) */}
                <div className="flex items-center space-x-6 z-10 relative">
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
                    <div className="relative group/model" ref={modelMenuRef}>
                        <button
                            onClick={() => setShowModelMenu(!showModelMenu)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 transition-all text-xs font-medium text-gray-700 dark:text-gray-200 border border-transparent hover:border-gray-200 dark:hover:border-white/10"
                        >
                            <span className="material-icons text-[16px] text-[#258cf4]">
                                {modelId === "light" ? "bolt" : (modelId === "balanced" ? "balance" : (modelId === "nano" ? "flash_on" : "stars"))}
                            </span>
                            <span>
                                {modelId === "light" ? "Light (Fast)" : (modelId === "balanced" ? "Balanced" : (modelId === "nano" ? "Nano (Super Light)" : "High Quality"))}
                            </span>
                            <span className={`material-icons text-[14px] text-gray-400 transition-transform duration-200 ${showModelMenu ? "rotate-180" : ""}`}>
                                expand_more
                            </span>
                        </button>

                        {/* Dropdown Menu */}
                        <div
                            className={`absolute top-full right-0 mt-2 w-64 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden transition-all duration-200 origin-top-right z-50 ${showModelMenu ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}`}
                        >
                            <div className="p-1 flex flex-col gap-1">
                                {[
                                    { id: "nano", icon: "flash_on", label: "Nano Mode", desc: "Super lightweight (~200MB). Minimal resource usage." },
                                    { id: "light", icon: "bolt", label: "Light Mode", desc: "Fastest response, standard memory usage." },
                                    { id: "balanced", icon: "balance", label: "Balanced Mode", desc: "Recommended balance of speed & quality." },
                                    { id: "high", icon: "stars", label: "High Quality", desc: "Maximum accuracy, slower generation." }
                                ].map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => {
                                            setModelId(option.id);
                                            setShowModelMenu(false);
                                        }}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg flex items-start gap-3 transition-colors ${modelId === option.id
                                            ? "bg-[#258cf4]/10 dark:bg-[#258cf4]/20"
                                            : "hover:bg-gray-100 dark:hover:bg-white/5"
                                            }`}
                                    >
                                        <span className={`material-icons text-[18px] mt-0.5 ${modelId === option.id ? "text-[#258cf4]" : "text-gray-400 dark:text-gray-500"}`}>
                                            {option.icon}
                                        </span>
                                        <div>
                                            <div className={`text-sm font-medium ${modelId === option.id ? "text-[#258cf4]" : "text-gray-700 dark:text-gray-200"}`}>
                                                {option.label}
                                            </div>
                                            <div className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">
                                                {option.desc}
                                            </div>
                                        </div>
                                        {modelId === option.id && (
                                            <span className="material-icons text-[16px] text-[#258cf4] ml-auto mt-1">check</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="w-px h-4 bg-gray-300 dark:bg-white/20"></div>

                    <div className="flex items-center gap-1 p-1 rounded-full bg-gray-100/50 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 hover:border-gray-300/80 dark:hover:border-white/10 transition-all duration-300">
                        <button
                            onClick={() => appWindow.minimize()}
                            className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center group/min transition-all"
                            title="Minimize"
                        >
                            <div className="w-3 h-3 rounded-full bg-black/10 dark:bg-white/20 group-hover/min:bg-black/20 dark:group-hover/min:bg-white/40 flex items-center justify-center transition-all">
                                <div className="w-1.5 h-[1.5px] bg-black/40 dark:bg-white/60 opacity-0 group-hover/min:opacity-100 transition-opacity"></div>
                            </div>
                        </button>
                        <button
                            onClick={() => appWindow.toggleMaximize()}
                            className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center group/max transition-all"
                            title="Maximize"
                        >
                            <div className="w-3 h-3 rounded-full bg-black/10 dark:bg-white/20 group-hover/max:bg-black/20 dark:group-hover/max:bg-white/40 flex items-center justify-center transition-all">
                                <div className="w-1.5 h-1.5 border-[1.5px] border-black/40 dark:border-white/60 opacity-0 group-hover/max:opacity-100 transition-opacity"></div>
                            </div>
                        </button>
                        <button
                            onClick={() => appWindow.close()}
                            className="w-8 h-8 rounded-full hover:bg-red-500/10 flex items-center justify-center group/close transition-all"
                            title="Close"
                        >
                            <div className="w-3 h-3 rounded-full bg-black/10 dark:bg-white/20 group-hover/close:bg-red-500 flex items-center justify-center transition-all">
                                <span className="material-icons text-[10px] text-white opacity-0 group-hover/close:opacity-100 transition-opacity">close</span>
                            </div>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
                {/* Input Area (Left) */}
                <div className="flex-1 relative group/input flex flex-col">
                    {/* Language Header */}
                    <div className="h-12 border-b border-gray-100 dark:border-white/5 flex items-center justify-center px-6 bg-white/50 dark:bg-white/[0.02] shrink-0">
                        <button
                            onClick={() => setSourceLang(sourceLang === "English" ? "Japanese" : "English")}
                            className="text-base font-medium text-gray-700 dark:text-gray-300 hover:text-[#258cf4] dark:hover:text-[#258cf4] transition-colors flex items-center gap-1"
                        >
                            {sourceLang}
                            <span className="material-icons text-[16px] opacity-50">expand_more</span>
                        </button>
                    </div>
                    <textarea
                        className="w-full flex-1 p-8 bg-transparent border-none text-2xl md:text-3xl text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-700 focus:ring-0 leading-relaxed font-light outline-none resize-none transition-all duration-200"
                        style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
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

                {/* Vertical Divider & Swap Button Container */}
                <div className="relative w-px md:w-auto flex flex-col justify-center items-center z-20">
                    <div className="absolute inset-0 flex justify-center">
                        <div className="w-full h-px md:w-px md:h-full bg-gray-100 dark:bg-white/5 transition-colors duration-300"></div>
                    </div>

                    {/* Centered Swap Button */}
                    <button
                        onClick={handleSwapLanguages}
                        className="relative z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-[#1a1a1a] text-gray-300 dark:text-gray-600 hover:text-[#258cf4] dark:hover:text-[#258cf4] hover:bg-gray-50 dark:hover:bg-white/5 transition-all active:scale-95 group/swap"
                        title="Swap Languages"
                    >
                        <span
                            className="material-icons text-xl transition-transform duration-300 transform group-hover/swap:scale-110"
                            style={{ transform: `rotate(${swapRotation}deg)` }}
                        >
                            swap_horiz
                        </span>
                    </button>
                </div>

                {/* Output Area (Right) */}
                <div className="flex-1 relative group/output flex flex-col">
                    {/* Language Header */}
                    <div className="h-12 border-b border-gray-100 dark:border-white/5 flex items-center justify-center px-6 bg-white/50 dark:bg-white/[0.02] shrink-0">
                        <button
                            onClick={() => setTargetLang(targetLang === "Japanese" ? "English" : "Japanese")}
                            className="text-base font-medium text-gray-700 dark:text-gray-300 hover:text-[#258cf4] dark:hover:text-[#258cf4] transition-colors flex items-center gap-1"
                        >
                            {targetLang}
                            <span className="material-icons text-[16px] opacity-50">expand_more</span>
                        </button>
                    </div>
                    {/* Result Display */}
                    <div className="w-full flex-1 p-8 overflow-y-auto">
                        <p
                            className="text-2xl md:text-3xl text-gray-900 dark:text-white leading-relaxed font-light whitespace-pre-wrap transition-all duration-200"
                            style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}
                        >
                            {translatedText || (
                                <span className="text-gray-400 dark:text-gray-500 font-display text-base" style={{ fontSize: '1rem' }}>
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
                <span>Spark v1.0 • {modelId === "balanced" ? "Balanced Mode" : (modelId === "light" ? "Light Mode" : (modelId === "nano" ? "Nano Mode" : "High Quality Mode"))}</span>
            </footer>
        </div>
    );
}

export default App;
