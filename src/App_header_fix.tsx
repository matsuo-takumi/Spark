<header className="h-10 shrink-0 flex items-center justify-between px-4 py-2 border-b border-white/10 relative z-50 bg-transparent">
    {/* Drag Region - Background Layer */}
    <div className="absolute inset-0 w-full h-full" data-tauri-drag-region></div>

    {/* Language Controls - Clickable Layer */}
    <div className="flex items-center gap-3 relative z-10 pointer-events-auto">
        <div className="flex bg-black/20 rounded-lg p-1">
            <button
                onClick={() => setSourceLang("Japanese")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${sourceLang === "Japanese" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"}`}
            >
                Japanese
            </button>
            <button onClick={handleSwapLanguages} className="px-2 text-white/40 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-sm">swap_horiz</span>
            </button>
            <button
                onClick={() => setTargetLang("English")}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${targetLang === "English" ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"}`}
            >
                English
            </button>
        </div>
    </div>

    {/* Window Controls - Clickable Layer */}
    <div className="flex items-center gap-0 relative z-10 pointer-events-auto">
        <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="h-[32px] w-[46px] flex items-center justify-center hover:bg-white/5 text-white/70 hover:text-white transition-colors rounded-lg mr-2"
            title="設定"
        >
            <span className="material-symbols-outlined text-[18px]">settings</span>
        </button>

        <button
            className="h-[32px] w-[46px] flex items-center justify-center hover:bg-white/5 text-white transition-colors group rounded-lg"
            title="最小化"
            onClick={() => appWindow.minimize()}
        >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0.5 5.5H9.5V4.5H0.5V5.5Z" fill="currentColor" />
            </svg>
        </button>
        <button
            className="h-[32px] w-[46px] flex items-center justify-center hover:bg-white/5 text-white transition-colors group rounded-lg"
            title="最大化"
            onClick={() => appWindow.toggleMaximize()}
        >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.5 1.5H8.5V8.5H1.5V1.5ZM0.5 0.5V9.5H9.5V0.5H0.5ZM1.5 8.5V1.5H8.5V8.5H1.5Z" fill="currentColor" />
            </svg>
        </button>
        <button
            className="h-[32px] w-[46px] flex items-center justify-center hover:bg-[#c42b1c] hover:text-white text-white transition-colors group rounded-lg"
            title="閉じる"
            onClick={() => appWindow.close()}
        >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0.5 0.5L9.5 9.5M9.5 0.5L0.5 9.5" stroke="currentColor" strokeWidth="1" />
            </svg>
        </button>
    </div>
</header>
