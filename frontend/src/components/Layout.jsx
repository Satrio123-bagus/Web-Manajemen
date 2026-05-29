import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationPanel from './NotificationPanel';
import { Search, Bell, User, Zap, Menu } from 'lucide-react';
export default function Layout({ children, activePage, onSearch, user }) {
    const [sidebarCollapsed] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [headerSearch, setHeaderSearch] = useState('');
    const navigate = useNavigate();

    // Handle search: navigate to inventory and trigger search
    const handleHeaderSearch = (e) => {
        if (e.key === 'Enter' && onSearch) {
            onSearch(headerSearch);
            navigate('/inventory');
        }
    };

    // Handle touch gestures for mobile sidebar
    const touchStartX = useRef(0);
    const touchStartY = useRef(0);

    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        
        const swipeDistanceX = touchEndX - touchStartX.current;
        const swipeDistanceY = Math.abs(touchEndY - touchStartY.current);

        // Ignore if scrolling vertically (Y distance > X distance)
        if (swipeDistanceY > Math.abs(swipeDistanceX)) return;

        // Swipe right to open (must start from left edge < 50px)
        if (swipeDistanceX > 60 && touchStartX.current < 50) {
            setMobileSidebarOpen(true);
        }
        // Swipe left to close (can happen anywhere if sidebar is open)
        else if (swipeDistanceX < -60 && mobileSidebarOpen) {
            setMobileSidebarOpen(false);
        }
    };

    return (
        <div 
            className="min-h-screen bg-[var(--color-dark-bg)] text-gray-200 font-sans relative overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* ── Ambient Background ── */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--color-neon-purple)] rounded-full blur-[180px] opacity-[0.12] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--color-neon-cyan)] rounded-full blur-[180px] opacity-[0.08] animate-pulse" style={{ animationDelay: '1s' }} />
                {/* Scanline grid */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_60%,transparent_100%)]" />
            </div>

            {/* ── Sidebar ── */}
            <Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} user={user} />

            {/* ── Main Wrapper (shifts right for sidebar) ── */}
            <div className={`transition-all duration-300 ml-0 md:ml-64`}>

                {/* ── Header ── */}
                <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 md:px-8 bg-black/50 backdrop-blur-xl border-b border-white/5">
                    {/* Left — Page title */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setMobileSidebarOpen(true)}
                            className="md:hidden p-2 -ml-2 rounded-lg text-gray-400 hover:text-[var(--color-neon-cyan)]"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <div className="w-2 h-2 rounded-full bg-[var(--color-neon-cyan)] shadow-[0_0_8px_var(--color-neon-cyan)] animate-pulse" />
                        <h2 className="text-sm font-mono tracking-[0.15em] text-gray-400 uppercase">
                            {activePage || 'dashboard'}
                            <span className="text-[var(--color-neon-cyan)] animate-[flicker_2s_infinite]">_</span>
                        </h2>
                    </div>

                    {/* Right — Search + Notifications + Avatar */}
                    <div className="flex items-center gap-2 md:gap-4">
                        {/* Search — navigates to inventory and filters items on Enter */}
                        <div className="relative hidden md:flex items-center bg-white/5 border border-white/10 rounded-full h-9 px-4 w-56 hover:border-[var(--color-neon-cyan)]/30 focus-within:border-[var(--color-neon-cyan)]/50 transition-colors group">
                            <Search className="w-4 h-4 text-gray-600 group-hover:text-[var(--color-neon-cyan)] transition-colors mr-2" />
                            <input
                                type="text"
                                value={headerSearch}
                                onChange={e => setHeaderSearch(e.target.value)}
                                onKeyDown={handleHeaderSearch}
                                placeholder="Search items... (Enter)"
                                className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-600 w-full font-mono"
                            />
                        </div>

                        {/* Notifications */}
                        <NotificationPanel />

                        {/* Separator */}
                        <div className="hidden md:block w-px h-8 bg-white/10" />

                        {/* Profile */}
                        <button className="flex items-center gap-3 group">
                            <div className="relative">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--color-neon-cyan)] to-[var(--color-neon-purple)] flex items-center justify-center shadow-[0_0_15px_rgba(0,243,255,0.3)] group-hover:shadow-[0_0_20px_rgba(188,19,254,0.4)] transition-shadow">
                                    <User className="w-5 h-5 text-black" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0a0a0c] shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                            </div>
                            <div className="hidden lg:block text-left">
                                <p className="text-xs font-bold text-gray-300 uppercase">{user?.username || 'OPERATOR'}</p>
                                <p className="text-[10px] font-mono text-gray-600 flex items-center gap-1 uppercase">
                                    <Zap className="w-3 h-3 text-amber-400" /> {user?.role || 'ADMIN_LV9'}
                                </p>
                            </div>
                        </button>
                    </div>
                </header>

                {/* ── Content Area ── */}
                <main className="p-4 md:p-8 relative z-10 min-h-[calc(100vh-4rem)] overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
