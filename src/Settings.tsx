import React from 'react';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
    if (!isOpen) return null;

    return (
        <div className="absolute inset-y-0 right-0 z-50 flex">
            <div className="relative w-[420px] h-full mica-effect border-l border-white/10 shadow-win-elevation flex flex-col">
                <div className="flex items-center justify-between px-6 pt-8 pb-4">
                    <h2 className="text-2xl font-semibold tracking-tight text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded hover:bg-white/10 text-win-text-secondary-dark hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-6">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-win-card-dark/50 border border-win-border-dark mb-6">
                        <div className="w-12 h-12 rounded-full bg-neutral-700 flex items-center justify-center text-xl font-bold text-white border border-neutral-600">
                            S
                        </div>
                        <div>
                            <div className="font-semibold text-sm text-white">Spark Pro</div>
                            <div className="text-xs text-win-text-secondary-dark">Local Account</div>
                        </div>
                    </div>

                    <section className="space-y-2">
                        <div className="flex items-center gap-2 px-1 text-win-text-secondary-dark mb-2">
                            <span className="material-symbols-outlined text-[20px]">psychology</span>
                            <h3 className="text-sm font-semibold">Model Configuration</h3>
                        </div>
                        <div className="bg-win-card-dark border border-win-border-dark rounded-lg overflow-hidden divide-y divide-win-border-dark">
                            <div className="win-card p-4 flex flex-col gap-3 cursor-default">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-neutral-400">smart_toy</span>
                                        <div>
                                            <div className="text-sm font-medium text-white">Large Language Model</div>
                                            <div className="text-xs text-win-text-secondary-dark">Select the active inference engine</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="relative w-full mt-1">
                                    <select className="w-full bg-[#353535] text-white border border-transparent hover:border-[#454545] rounded-[4px] px-3 py-2 appearance-none focus:ring-1 focus:ring-white/50 focus:border-white/50 outline-none transition-all cursor-pointer text-sm">
                                        <option value="gemma-2b">Gemma-2-2B-it (Recommended)</option>
                                        <option value="llama-3">Llama-3-8B-Quant</option>
                                        <option value="mistral">Mistral-7B-v0.3</option>
                                        <option value="phi-3">Phi-3-Mini</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-2.5 text-neutral-400 pointer-events-none text-sm">expand_more</span>
                                </div>
                            </div>
                            <div className="win-card p-4 flex items-center justify-between cursor-default">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-neutral-400">memory</span>
                                    <div>
                                        <div className="text-sm font-medium text-white">Hardware Acceleration</div>
                                        <div className="text-xs text-win-text-secondary-dark flex items-center gap-1.5">
                                            Use GPU for inference
                                            <span className="text-[10px] bg-neutral-700 text-neutral-300 px-1.5 py-0.5 rounded border border-neutral-600">RTX 4090</span>
                                        </div>
                                    </div>
                                </div>
                                <label className="win-toggle">
                                    <input defaultChecked type="checkbox" />
                                    <span className="slider"></span>
                                </label>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-2">
                        <div className="flex items-center gap-2 px-1 text-win-text-secondary-dark mb-2">
                            <span className="material-symbols-outlined text-[20px]">speed</span>
                            <h3 className="text-sm font-semibold">Performance</h3>
                        </div>
                        <div className="bg-win-card-dark border border-win-border-dark rounded-lg overflow-hidden divide-y divide-win-border-dark">
                            <div className="win-card p-4 space-y-4 cursor-default">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-neutral-400">bolt</span>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-white">Response Latency</div>
                                        <div className="text-xs text-win-text-secondary-dark">Adjust preview generation delay</div>
                                    </div>
                                    <span className="text-xs font-mono text-white bg-neutral-700 px-2 py-1 rounded">15ms</span>
                                </div>
                                <div className="px-1 pb-1">
                                    <input className="w-full" max="100" min="0" type="range" defaultValue="85" />
                                    <div className="flex justify-between mt-2 px-0.5 text-[10px] text-neutral-500 uppercase font-medium tracking-wide">
                                        <span>Power Saver</span>
                                        <span>Instant</span>
                                    </div>
                                </div>
                            </div>
                            <div className="win-card p-4 space-y-3 cursor-default">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <span className="material-symbols-outlined text-neutral-400">sd_card</span>
                                        <div>
                                            <div className="text-sm font-medium text-white">Context Window</div>
                                            <div className="text-xs text-win-text-secondary-dark">VRAM allocation for history</div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-neutral-400">2.4 / 8.0 GB</span>
                                </div>
                                <div className="w-full bg-neutral-700 rounded-full h-1 overflow-hidden mt-2">
                                    <div className="bg-white h-1 rounded-full" style={{ width: '30%' }}></div>
                                </div>
                            </div>
                        </div>
                    </section>

                    <div className="pt-2 pb-6 flex justify-start px-1">
                        <a className="text-sm text-win-text-primary-dark hover:text-neutral-300 underline underline-offset-4 decoration-neutral-600 hover:decoration-neutral-400 transition-all flex items-center gap-2 group" href="#">
                            Advanced System Configuration
                            <span className="material-symbols-outlined text-sm transform group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
