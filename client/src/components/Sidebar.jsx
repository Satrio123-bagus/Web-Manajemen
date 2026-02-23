import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Package, BarChart3, Settings, Terminal,
    ChevronLeft, ChevronRight, Wifi, Cpu, Activity, X
} from 'lucide-react';

const NAV_ITEMS = [
    { icon: LayoutDashboard, label: 'DASHBOARD', to: '/' },
    { icon: Package, label: 'INVENTORY', to: '/inventory' },
    { icon: BarChart3, label: 'ANALYTICS', to: '/analytics' },
    { icon: Terminal, label: 'TERMINAL', to: '/terminal' },
    { icon: Settings, label: 'SETTINGS', to: '/settings' },
];

export default function Sidebar({ isOpen, onClose }) {
    const [collapsed, setCollapsed] = useState(false);

    // Close sidebar on navigation
    const handleNavClick = () => {
        if (window.innerWidth < 768) { // md breakpoint
            onClose();
        }
    };

    return (
        <>
            {/* Overlay for mobile */}
            <div
                className={`fixed inset-0 bg-black/60 z-30 md:hidden ${isOpen ? 'block' : 'hidden'}`}
                onClick={onClose}
            />

            <aside
                className={`fixed top-0 left-0 h-screen z-40 flex flex-col transition-transform duration-300 ease-in-out
                ${collapsed ? 'w-20' : 'w-64'}
                bg-black/40 backdrop-blur-xl border-r border-white/5 
                md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                {/* ── Logo & Close Button ── */}
                <div className="h-16 flex items-center justify-center border-b border-white/5 px-4 shrink-0 relative">
                    {collapsed ? (
                        <span className="text-xl font-black text-[var(--color-neon-cyan)] drop-shadow-[0_0_8px_rgba(0,243,255,0.6)]">
                            I3C
                        </span>
                    ) : (
                        <span className="text-lg font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-neon-cyan)] to-[var(--color-neon-purple)] drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]">
                            INSERT<span className="text-white">3</span>COINS
                        </span>
                    )}
                    <button onClick={onClose} className="md:hidden absolute top-4 right-4 p-1 text-gray-500 hover:text-white rounded-md">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── Navigation ── */}
                <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                    {NAV_ITEMS.map(({ icon: Icon, label, to }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            onClick={handleNavClick}
                            title={collapsed ? label : undefined}
                            className={({ isActive }) =>
                                `w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-mono tracking-wider transition-all duration-200 group relative no-underline
              ${isActive
                                    ? 'bg-[var(--color-neon-cyan)]/10 text-[var(--color-neon-cyan)] shadow-[inset_0_0_20px_rgba(0,243,255,0.08)]'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {/* Active indicator bar */}
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-[var(--color-neon-cyan)] rounded-r shadow-[0_0_8px_var(--color-neon-cyan)]" />
                                    )}
                                    <Icon className={`w-5 h-5 shrink-0 transition-all ${isActive ? 'drop-shadow-[0_0_6px_rgba(0,243,255,0.7)]' : 'group-hover:text-[var(--color-neon-cyan)]'}`} />
                                    {!collapsed && <span>{label}</span>}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* ── System Status ── */}
                <div className={`border-t border-white/5 px-4 py-4 space-y-3 shrink-0 ${collapsed ? 'px-2' : ''}`}>
                    {!collapsed && (
                        <p className="text-[9px] font-mono tracking-[0.2em] text-gray-600 uppercase">
                            System Status
                        </p>
                    )}
                    <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
                        <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        {!collapsed && <span className="text-[10px] font-mono text-emerald-400">LINK: ACTIVE</span>}
                    </div>
                    <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
                        <Cpu className="w-3.5 h-3.5 text-[var(--color-neon-cyan)]" />
                        {!collapsed && <span className="text-[10px] font-mono text-gray-500">NODE: EXPRESS:5000</span>}
                    </div>
                    <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
                        <Activity className="w-3.5 h-3.5 text-[var(--color-neon-purple)]" />
                        {!collapsed && <span className="text-[10px] font-mono text-gray-500">VITE: DEV:5173</span>}
                    </div>
                </div>

                {/* ── Collapse Toggle ── */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="h-10 border-t border-white/5 flex items-center justify-center text-gray-600 hover:text-[var(--color-neon-cyan)] hover:bg-white/5 transition-all shrink-0"
                >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
            </aside>
        </>
    );
}
