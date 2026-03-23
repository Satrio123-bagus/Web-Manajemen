import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, Package, BarChart3, Settings, Bot,
    ChevronLeft, ChevronRight, Wifi, Cpu, Activity, X, LogOut
} from 'lucide-react';
import { useSound } from '../hooks/useSound';
import api from '../api';

const NAV_ITEMS = [
    { icon: LayoutDashboard, label: 'DASHBOARD', to: '/' },
    { icon: Package, label: 'INVENTORY', to: '/inventory' },
    { icon: BarChart3, label: 'ANALYTICS', to: '/analytics' },
    { icon: Bot, label: 'AI MANAGER', to: '/terminal' },
    { icon: Settings, label: 'SETTINGS', to: '/settings' },
];

export default function Sidebar({ isOpen, onClose }) {
    const [collapsed, setCollapsed] = useState(false);
    const [systemStatus, setSystemStatus] = useState('CHECKING'); // CHECKING, ONLINE, OFFLINE
    const [latency, setLatency] = useState(0);
    const [serverInfo, setServerInfo] = useState('EXPRESS');
    const { playSound } = useSound();

    // Polling server status
    useEffect(() => {
        let isMounted = true;

        const checkStatus = async () => {
            try {
                const startTime = Date.now();
                const res = await api.get('/status', {
                    // Prevent caching for accurate status
                    headers: { 'Cache-Control': 'no-cache' }
                });

                if (!isMounted) return;

                if (res.ok) {
                    const data = await res.json();
                    setSystemStatus('ONLINE');
                    setLatency(Date.now() - startTime);
                    if (data.system) setServerInfo(data.system.split(' ')[0]); // 'INSERT3COINS'
                } else {
                    setSystemStatus('OFFLINE');
                }
            } catch {
                if (isMounted) setSystemStatus('OFFLINE');
            }
        };

        // Initial check
        checkStatus();

        // Poll every 30 seconds
        const intervalId = setInterval(checkStatus, 30000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, []);

    // Close sidebar on navigation
    const handleNavClick = () => {
        playSound('hover');
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

                    {/* Link Status */}
                    <div className={`flex items-center justify-between ${collapsed ? 'justify-center' : ''}`}>
                        <div className="flex items-center gap-2">
                            <Wifi className={`w-3.5 h-3.5 ${systemStatus === 'ONLINE' ? 'text-emerald-400 animate-pulse' :
                                systemStatus === 'CHECKING' ? 'text-amber-400 animate-pulse' :
                                    'text-red-500'
                                }`} />
                            {!collapsed && <span className={`text-[10px] font-mono ${systemStatus === 'ONLINE' ? 'text-emerald-400' :
                                systemStatus === 'CHECKING' ? 'text-amber-400' :
                                    'text-red-500'
                                }`}>LINK: {systemStatus}</span>}
                        </div>
                    </div>

                    {/* Node / Backend Info */}
                    <div className={`flex items-center justify-between ${collapsed ? 'hidden' : ''}`}>
                        <div className="flex items-center gap-2">
                            <Cpu className="w-3.5 h-3.5 text-[var(--color-neon-cyan)]" />
                            <span className="text-[10px] font-mono text-gray-500">NODE: {serverInfo}</span>
                        </div>
                        {systemStatus === 'ONLINE' && latency > 0 && (
                            <span className="text-[9px] font-mono text-gray-600">{latency}ms</span>
                        )}
                    </div>

                    {/* Client Info */}
                    <div className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
                        <Activity className="w-3.5 h-3.5 text-[var(--color-neon-purple)]" />
                        {!collapsed && <span className="text-[10px] font-mono text-gray-500">CLIENT: ACTIVE</span>}
                    </div>
                </div>

                {/* ── Logout Button ── */}
                <button
                    onClick={() => { playSound('error'); localStorage.removeItem('cortex_token'); window.location.href='/'; }}
                    className={`h-12 border-t border-white/5 flex items-center ${collapsed ? 'justify-center' : 'px-6 gap-3'} text-red-500/80 hover:text-red-500 hover:bg-red-500/10 transition-all shrink-0 w-full hover:shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]`}
                >
                    <LogOut className="w-5 h-5 shrink-0" />
                    {!collapsed && <span className="text-sm font-mono tracking-wider font-bold">DISCONNECT</span>}
                </button>

                {/* ── Collapse Toggle ── */}
                <button
                    onClick={() => { playSound('click'); setCollapsed(!collapsed); }}
                    className="h-10 border-t border-white/5 flex items-center justify-center text-gray-600 hover:text-[var(--color-neon-cyan)] hover:bg-white/5 transition-all shrink-0 w-full"
                >
                    {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
            </aside>
        </>
    );
}
