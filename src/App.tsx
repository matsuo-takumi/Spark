import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Settings } from "./Settings";
import "./App.css";

const appWindow = getCurrentWindow();

function App() {
    const [inputText, setInputText] = useState("");
    const [translatedText, setTranslatedText] = useState("");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const [sourceLang, setSourceLang] = useState("English");
    const [targetLang, setTargetLang] = useState("Japanese");
    const [isTranslating, setIsTranslating] = useState(false);

    useEffect(() => {
        // Set up event listener for streaming translations
        const unlistenPromise = listen<{ chunk: string; is_last: boolean }>("translation-event", (event) => {
            console.log("📥 Event received:", event.payload.chunk.substring(0, 50), "is_last:", event.payload.is_last);

            setTranslatedText((prev) => {
                const newText = prev === "翻訳中..." ? event.payload.chunk : prev + event.payload.chunk;
                console.log("Updated text length:", newText.length);
                return newText;
            });

            if (event.payload.is_last) {
                setIsTranslating(false);
                console.log("✅ Translation complete");
            }
        });

        // Debug Log Listener
        const unlistenLogPromise = listen<string>("debug-log", (event) => {
            console.log("🛠️ BACKEND LOG:", event.payload);
        });

        return () => {
            unlistenPromise.then((unlisten) => unlisten());
            unlistenLogPromise.then((unlisten) => unlisten());
        };
    }, []);

    async function handleTranslate() {
        if (!inputText.trim()) return;

        console.log("🚀 Starting translation:", inputText.substring(0, 30));
        try {
            setIsTranslating(true);
            setTranslatedText("翻訳中...");
            console.log("Calling invoke with:", sourceLang, "→", targetLang);
            await invoke("translate", {
                text: inputText,
                sourceLang,
                targetLang
            });
            console.log("✅ Invoke completed successfully");
        } catch (err) {
            console.error("❌ Translation Error:", err);
            setTranslatedText("エラー: " + err);
            setIsTranslating(false);
        }
    }

    const handleSwapLanguages = () => {
        const temp = sourceLang;
        setSourceLang(targetLang);
        setTargetLang(temp);
        const tempText = inputText;
        setInputText(translatedText);
        setTranslatedText(tempText);
    };

    return (
        <div className="w-full h-full bg-[#f5f7f8] dark:bg-[#101922] font-display flex flex-col overflow-hidden relative group transition-colors duration-300">
            {/* Top Bar */}
            <header className="h-16 border-b border-gray-200 dark:border-white/10 flex items-center justify-between px-6 bg-white dark:bg-black shrink-0 relative z-10">
                {/* Drag Handler */}
                <div className="absolute inset-0 w-full h-full z-0" data-tauri-drag-region></div>

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
                        <span className="material-icons text-xl group-hover/swap:rotate-180 transition-transform duration-300">swap_horiz</span>
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
                <div className="flex gap-2 z-10 relative opacity-50 hover:opacity-100 transition-opacity duration-200">
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

                    {/* Action Floating Button */}
                    <div className="absolute bottom-6 right-6 flex gap-3 z-50">
                        {/* Translate Button (Manual) */}
                        <button
                            onClick={handleTranslate}
                            disabled={isTranslating || !inputText.trim()}
                            aria-label="Translate"
                            className="p-3 rounded-full bg-white dark:bg-black border border-gray-200 dark:border-white/20 text-gray-400 dark:text-gray-500 hover:text-[#258cf4] dark:hover:text-[#258cf4] hover:border-[#258cf4] dark:hover:border-[#258cf4] transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="material-icons text-xl">{isTranslating ? "hourglass_empty" : "translate"}</span>
                        </button>

                        {/* Copy Button (Primary Action) */}
                        <button
                            onClick={() => navigator.clipboard.writeText(translatedText)}
                            aria-label="Copy Translation"
                            className="p-3 rounded-full bg-black dark:bg-white text-white dark:text-black hover:bg-[#258cf4] dark:hover:bg-[#258cf4] hover:text-white dark:hover:text-white transition-colors shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center group/copy"
                        >
                            <span className="material-icons text-xl group-active/copy:hidden">content_copy</span>
                            <span className="material-icons text-xl hidden group-active/copy:block">check</span>
                        </button>
                    </div>
                </div>
            </main>

            {/* Status Bar (Very Minimal) */}
            <footer className="h-8 bg-white dark:bg-black border-t border-gray-200 dark:border-white/10 flex items-center justify-between px-4 text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-600 shrink-0">
                <span>{isTranslating ? "Processing..." : "Ready"}</span>
                <span>Spark v1.0</span>
            </footer>

            <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </div>
    );
}

export default App;
