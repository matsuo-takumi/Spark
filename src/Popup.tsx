import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./App.css"; // Reuse globally defined styles if needed, or inline

const appWindow = getCurrentWindow();

export default function Popup() {
    const [text, setText] = useState("");
    const [translation, setTranslation] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [logs, setLogs] = useState<string[]>([]);
    const [fontSize, setFontSize] = useState(16); // Default font size
    const [sourceLang, setSourceLang] = useState("English");
    const [targetLang, setTargetLang] = useState("Japanese");
    const [modelId, setModelId] = useState(() => {
        if (typeof window !== "undefined" && window.localStorage) {
            const saved = window.localStorage.getItem("defaultModel");
            if (saved && ["nano", "light", "balanced", "high"].includes(saved)) {
                return saved;
            }
        }
        return "balanced";
    });
    const [theme, setTheme] = useState("dark"); // Default to dark, will update from localstorage
    const [showModelMenu, setShowModelMenu] = useState(false);

    // Initial setup & Theme
    useEffect(() => {
        // Theme init
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme) {
            setTheme(savedTheme);
            if (savedTheme === "dark") {
                document.documentElement.classList.add("dark");
            } else {
                document.documentElement.classList.remove("dark");
            }
        } else {
            // Default dark for popup if unrelated
            document.documentElement.classList.add("dark");
        }

        // Listen for data from backend
        const unlistenPromise = listen<string>("popup-data", (event) => {
            setText(event.payload);
            setTranslation("");
            setLoading(true);
            setError(null);
            setLogs([]); // Clear logs on new request

            // Trigger translation immediately
            translateText(event.payload, sourceLang, targetLang, modelId);
        });

        // Listen for translation chunks (streaming)
        const unlistenTranslationPromise = listen<{ chunk: string; is_last: boolean }>("translation-event-popup", (event) => {
            if (event.payload.chunk) {
                setTranslation((prev) => prev + event.payload.chunk);
            }
            if (event.payload.is_last) {
                setLoading(false);
            }
        });

        // Listen for debug logs
        const unlistenDebugPromise = listen<string>("debug-log", (event) => {
            setLogs((prev) => [...prev.slice(-4), event.payload]); // Keep last 5 logs
        });

        // Listen for theme changes from main window
        const unlistenThemePromise = listen<string>("theme-changed", (event) => {
            const newTheme = event.payload;
            setTheme(newTheme);
            if (newTheme === "dark") {
                document.documentElement.classList.add("dark");
            } else {
                document.documentElement.classList.remove("dark");
            }
        });

        // Close on Escape key
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                appWindow.hide();
            }
        };
        window.addEventListener("keydown", handleKeyDown);

        // Close menus when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            // For simplicity in popup, we can just close if clicking away from specific areas, 
            // but let's just close the menu if clicking anywhere else in the window really.
            // Actually, we need to check if click is inside the menu.
            const target = event.target as HTMLElement;
            if (!target.closest('.group\\/model-menu')) {
                setShowModelMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            unlistenPromise.then((unlisten) => unlisten());
            unlistenTranslationPromise.then((unlisten) => unlisten());
            unlistenDebugPromise.then((unlisten) => unlisten());
            unlistenThemePromise.then((unlisten) => unlisten());
            window.removeEventListener("keydown", handleKeyDown);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [sourceLang, targetLang, modelId]); // Re-bind if langs/model change? text is in closure... actually handleKeyDown needs refs or deps.

    // Better to use ref for current langs in event listener if we want to swap without re-binding everything, 
    // but re-binding `handleKeyDown` is fine.

    // Add Shortcuts for Swap and Mode Cycle
    useEffect(() => {
        const handleShortcut = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === "Tab") {
                e.preventDefault();
                handleSwap();
            }
            if (e.ctrlKey && (e.key === "m" || e.key === "M")) {
                e.preventDefault();
                cycleMode();
            }
            if (e.ctrlKey && (e.key === "q" || e.key === "Q")) {
                e.preventDefault();
                appWindow.hide();
            }
            if (e.ctrlKey && e.key === "Enter") {
                e.preventDefault();
                if (text) {
                    setTranslation("");
                    setLoading(true);
                    translateText(text, sourceLang, targetLang, modelId);
                }
            }
        };
        window.addEventListener("keydown", handleShortcut);
        return () => window.removeEventListener("keydown", handleShortcut);
    }, [sourceLang, targetLang, text, modelId]); // Need text to re-translate


    // Font size adjustment via Ctrl + Scroll
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                setFontSize((prev) => {
                    const newSize = prev - Math.sign(e.deltaY) * 2; // Increase/decrease by 2px
                    return Math.max(10, Math.min(newSize, 48)); // Clamp between 10px and 48px
                });
            }
        };
        window.addEventListener("wheel", handleWheel, { passive: false });
        return () => window.removeEventListener("wheel", handleWheel);
    }, []);

    async function translateText(sourceText: string, src: string, tgt: string, model: string = modelId) {
        if (!sourceText.trim()) return;

        try {
            await invoke("translate", {
                text: sourceText,
                sourceLang: src,
                targetLang: tgt,
                modelId: model // Use the passed model parameter
            });
        } catch (err) {
            console.error(err);
            setError(String(err));
            setLoading(false);
        }
    }

    const cycleMode = () => {
        const modes = ["nano", "light", "balanced", "high"];
        const currentIndex = modes.indexOf(modelId);
        const nextIndex = (currentIndex + 1) % modes.length;
        const nextMode = modes[nextIndex];
        setModelId(nextMode);

        // Re-trigger translation if needed? User might want to cycle before translating.
        // But if text is present, maybe re-translate?
        if (text) {
            setTranslation("");
            setLoading(true);
            translateText(text, sourceLang, targetLang, nextMode);
        }
    };

    const handleSwap = () => {
        const newSource = targetLang;
        const newTarget = sourceLang;
        setSourceLang(newSource);
        setTargetLang(newTarget);
        if (text) {
            setTranslation("");
            setLoading(true);
            translateText(text, newSource, newTarget, modelId);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(translation);
        appWindow.hide();
    };

    return (
        <div className={`h-screen w-screen flex flex-col overflow-hidden font-display p-6 shadow-2xl items-start justify-start select-none transition-colors duration-300
            ${theme === 'dark' ? 'bg-black/80 text-white border-white/10' : 'bg-white/90 text-gray-900 border-black/5'}
            backdrop-blur-xl border rounded-xl`}
            data-tauri-drag-region
        >
            {/* Header / Actions */}
            <div className="flex justify-between items-center w-full mb-4 shrink-0 z-50">
                {/* App Menu */}
                <div className="relative group/app-menu z-50">
                    <button className="opacity-50 hover:opacity-100 p-1 rounded hover:bg-white/10">
                        <span className="material-icons text-lg">menu</span>
                    </button>
                    <div className="absolute top-full left-0 mt-2 w-48 bg-[#1a1a1a] border border-white/20 rounded-lg shadow-xl overflow-hidden hidden group-hover/app-menu:block backdrop-blur-md">
                        <button onClick={() => invoke('open_main_window')} className="w-full text-left px-4 py-3 hover:bg-white/10 flex items-center gap-2 text-sm text-gray-200">
                            <span className="material-icons text-sm">open_in_new</span> Open Main Window
                        </button>
                        <button onClick={() => invoke('quit_app')} className="w-full text-left px-4 py-3 hover:bg-red-900/30 flex items-center gap-2 text-sm text-red-400">
                            <span className="material-icons text-sm">power_settings_new</span> Quit Spark
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 items-center text-xs uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity cursor-pointer" onClick={handleSwap}>
                    <span className="material-icons text-sm">translate</span>
                    <span className="font-semibold">{sourceLang === "English" ? "EN" : "JP"}</span>
                    <span className="material-icons text-xs">arrow_forward</span>
                    <span className="font-semibold">{targetLang === "English" ? "EN" : "JP"}</span>
                </div>

                {/* Mode Indicator & Dropdown */}
                <div className="relative group/model-menu z-50">
                    <div
                        onClick={() => setShowModelMenu(!showModelMenu)}
                        className="flex gap-1 items-center text-[10px] uppercase tracking-wider opacity-50 hover:opacity-100 transition-opacity cursor-pointer mx-auto px-2 py-1 rounded hover:bg-white/5"
                    >
                        <span className="material-icons text-[12px]">
                            {modelId === "light" ? "bolt" : (modelId === "balanced" ? "balance" : (modelId === "nano" ? "flash_on" : "stars"))}
                        </span>
                        <span>{modelId}</span>
                        <span className={`material-icons text-[10px] transition-transform duration-200 ${showModelMenu ? "rotate-180" : ""}`}>expand_more</span>
                    </div>

                    {/* Dropdown Menu */}
                    {showModelMenu && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-[#1a1a1a] border border-white/20 rounded-lg shadow-xl overflow-hidden backdrop-blur-md flex flex-col z-[100]">
                            {[
                                { id: "nano", icon: "flash_on", label: "Nano" },
                                { id: "light", icon: "bolt", label: "Light" },
                                { id: "balanced", icon: "balance", label: "Balanced" },
                                { id: "high", icon: "stars", label: "High" }
                            ].map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => {
                                        setModelId(option.id);
                                        setShowModelMenu(false);
                                        // Auto re-translate on change?
                                        if (text) {
                                            setTranslation("");
                                            setLoading(true);
                                            translateText(text, sourceLang, targetLang, option.id);
                                        }
                                    }}
                                    className={`w-full text-left px-4 py-2 hover:bg-white/10 flex items-center gap-2 text-xs text-gray-200 ${modelId === option.id ? "bg-white/5 text-blue-400" : ""}`}
                                >
                                    <span className="material-icons text-sm">{option.icon}</span>
                                    <span>{option.label}</span>
                                    {modelId === option.id && <span className="material-icons text-xs ml-auto">check</span>}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <button onClick={() => appWindow.hide()} className="opacity-50 hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/10">
                    <span className="material-icons text-lg">close</span>
                </button>
            </div>

            {/* Source Text Removed as per request */}

            {/* Divider Removed */}

            {/* Translation */}
            <div className="w-full flex-1 overflow-y-auto mb-4">
                {translation ? (
                    <div
                        className="font-light leading-relaxed whitespace-pre-wrap transition-all duration-200"
                        style={{ fontSize: `${fontSize}px` }}
                    >
                        {translation}
                    </div>
                ) : (
                    loading && (
                        <div className="flex items-center gap-2 text-gray-500 animate-pulse">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            Translating...
                        </div>
                    )
                )}
                {error && <div className="text-red-400 text-sm">Error: {error}</div>}
            </div>

            {/* Footer Actions */}
            <div className="w-full flex justify-between items-end gap-2">
                {/* Debug Logs */}
                <div className="flex-1 text-[10px] text-gray-600 font-mono leading-tight overflow-hidden h-8 flex flex-col justify-end">
                    {logs.map((log, i) => (
                        <div key={i} className="truncate">{log}</div>
                    ))}
                </div>

                <button
                    onClick={handleCopy}
                    className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2 shrink-0"
                >
                    <span className="material-icons text-base">content_copy</span>
                    Copy & Close
                </button>
            </div>
        </div>
    );
}
