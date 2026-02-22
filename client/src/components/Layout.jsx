import { useState } from 'react';
import Sidebar from './Sidebar';
import { Search, Bell, User, Zap } from 'lucide-react';

export default function Layout({ children, activePage }) {
    const [sidebarCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-[var(--color-dark-bg)] text-gray-200 font-sans relative overflow-hidden">
            {/* ── Ambient Background ── */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--color-neon-purple)] rounded-full blur-[180px] opacity-[0.12] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--color-neon-cyan)] rounded-full blur-[180px] opacity-[0.08] animate-pulse" style={{ animationDelay: '1s' }} />
                {/* Scanline grid */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_60%,transparent_100%)]" />
            </div>

            {/* ── Sidebar ── */}
            <Sidebar />

            {/* ── Main Wrapper (shifts right for sidebar) ── */}
            <div className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>

                {/* ── Header ── */}
                <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-8 bg-black/50 backdrop-blur-xl border-b border-white/5">
                    {/* Left — Page title */}
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-[var(--color-neon-cyan)] shadow-[0_0_8px_var(--color-neon-cyan)] animate-pulse" />
                        <h2 className="text-sm font-mono tracking-[0.15em] text-gray-400 uppercase">
                            {activePage || 'dashboard'}
                            <span className="text-[var(--color-neon-cyan)] animate-[flicker_2s_infinite]">_</span>
                        </h2>
                    </div>

                    {/* Right — Search + Notifications + Avatar */}
                    <div className="flex items-center gap-4">
                        {/* Search */}
                        <div className="relative hidden md:flex items-center bg-white/5 border border-white/10 rounded-full h-9 px-4 w-56 hover:border-[var(--color-neon-cyan)]/30 transition-colors group">
                            <Search className="w-4 h-4 text-gray-600 group-hover:text-[var(--color-neon-cyan)] transition-colors mr-2" />
                            <input
                                type="text"
                                placeholder="Search systems..."
                                className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-600 w-full font-mono"
                            />
                        </div>

                        {/* Notification bell */}
                        <button className="relative p-2 rounded-lg text-gray-500 hover:text-[var(--color-neon-cyan)] hover:bg-white/5 transition-all">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
                        </button>

                        {/* Separator */}
                        <div className="w-px h-8 bg-white/10" />

                        {/* Profile */}
                        <button className="flex items-center gap-3 group">
                            <div className="relative">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-neon-cyan)] to-[var(--color-neon-purple)] flex items-center justify-center shadow-[0_0_15px_rgba(0,243,255,0.3)] group-hover:shadow-[0_0_20px_rgba(188,19,254,0.4)] transition-shadow">
                                    <User className="w-5 h-5 text-black" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0a0c] shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                            </div>
                            <div className="hidden lg:block text-left">
                                <p className="text-xs font-bold text-gray-300">OPERATOR</p>
                                <p className="text-[10px] font-mono text-gray-600 flex items-center gap-1">
                                    <Zap className="w-3 h-3 text-amber-400" /> ADMIN_LV9
                                </p>
                            </div>
                        </button>
                    </div>
                </header>

                {/* ── Content Area ── */}
                <main className="p-8 relative z-10 min-h-[calc(100vh-4rem)] overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
