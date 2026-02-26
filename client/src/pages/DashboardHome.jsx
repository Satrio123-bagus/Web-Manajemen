import { useState, useEffect, useRef, useMemo } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip
} from 'recharts';
import {
    Coins, Cpu, AlertTriangle, Terminal as TerminalIcon,
    Shield, Zap, ChevronRight, Activity
} from 'lucide-react';

const NEON_CYAN = '#00f3ff';
const NEON_PURPLE = '#bc13fe';

/* ═══════════════════════════════════════════════════════════
   COUNTING-UP HOOK
   ═══════════════════════════════════════════════════════════ */
function useCountUp(target, duration = 2000) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!target) return;
        let start = 0;
        const step = target / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= target) { setValue(target); clearInterval(timer); }
            else setValue(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [target, duration]);
    return value;
}

/* ═══════════════════════════════════════════════════════════
   GLITCH TEXT
   ═══════════════════════════════════════════════════════════ */
function GlitchHeader({ children, className = '' }) {
    return (
        <div className={`relative group inline-block ${className}`}>
            <span className="relative z-10">{children}</span>
            <span className="absolute inset-0 text-[var(--color-neon-cyan)] opacity-0 group-hover:opacity-70 group-hover:animate-[glitch_0.3s_infinite] select-none pointer-events-none mix-blend-screen" aria-hidden>{children}</span>
            <span className="absolute inset-0 text-[var(--color-neon-purple)] opacity-0 group-hover:opacity-70 group-hover:animate-[glitch_0.3s_infinite_reverse_0.05s] select-none pointer-events-none mix-blend-multiply" aria-hidden>{children}</span>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   GLASS CARD WRAPPER
   ═══════════════════════════════════════════════════════════ */
function GlassCard({ children, className = '', delay = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay }}
            className={`relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 overflow-hidden group ${className}`}
        >
            {children}
        </motion.div>
    );
}

/* ═══════════════════════════════════════════════════════════
   CUSTOM TOOLTIP
   ═══════════════════════════════════════════════════════════ */
function CyberTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-black/90 border border-[var(--color-neon-cyan)]/30 backdrop-blur-xl rounded-lg px-4 py-2 shadow-[0_0_20px_rgba(0,243,255,0.15)]">
            <p className="text-[10px] font-mono text-gray-500">{label}</p>
            {payload.map((e, i) => (
                <p key={i} className="text-xs font-mono font-bold" style={{ color: e.color }}>
                    {e.name}: {Number(e.value).toLocaleString()}
                </p>
            ))}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   TERMINAL LOG HELPERS
   ═══════════════════════════════════════════════════════════ */
function formatLogTime(isoString) {
    if (!isoString) return '--:--:--';
    return new Date(isoString).toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

function formatLogMsg(tx) {
    switch (tx.type) {
        case 'SALE': return `[SALE] Sold ${tx.quantity}x "${tx.item_name}" — Revenue: Rp${Number(tx.total).toLocaleString('id-ID')}`;
        case 'RESTOCK': return `[RESTOCK] Received ${tx.quantity}x "${tx.item_name}"`;
        case 'CREATE': return `[CREATE] New item registered: "${tx.item_name}"`;
        case 'UPDATE': return `[UPDATE] Data for "${tx.item_name}" was modified.`;
        case 'DELETE': return `[DELETE] Item "${tx.item_name}" deconstructed.`;
        default: return `[${tx.type || 'EVENT'}] "${tx.item_name}"`;
    }
}

function logColor(type) {
    switch (type) {
        case 'SALE': return 'text-[var(--color-neon-cyan)]';
        case 'RESTOCK': return 'text-violet-400';
        case 'CREATE': return 'text-emerald-400';
        case 'DELETE': return 'text-red-400';
        case 'UPDATE': return 'text-amber-400';
        default: return 'text-gray-400';
    }
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD HOME
   ═══════════════════════════════════════════════════════════ */
export default function DashboardHome() {
    const [analytics, setAnalytics] = useState(null);
    const [items, setItems] = useState([]);
    const [terminalLogs, setTerminalLogs] = useState([]);
    const logRef = useRef(null);

    // Fetch analytics, items, dan transaksi
    useEffect(() => {
        const fetchAll = () => {
            Promise.all([
                fetch('/api/analytics').then(r => r.json()),
                fetch('/api/items').then(r => r.json()),
                fetch('/api/transactions').then(r => r.json()),
            ]).then(([a, i, t]) => {
                setAnalytics(a);
                setItems(i);
                setTerminalLogs(t);
            }).catch(console.error);
        };

        fetchAll();
        const interval = setInterval(() => {
            fetch('/api/transactions').then(r => r.json()).then(setTerminalLogs).catch(console.error);
        }, 5000); // Poll transaksi setiap 5 detik

        return () => clearInterval(interval);
    }, []);

    // Auto-scroll terminal log
    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [terminalLogs]);

    const lowStockItems = useMemo(() => items.filter(i => i.stock < 5), [items]);
    const totalValue = analytics?.totalStockValue || 0;
    const totalItems = analytics?.totalItems || 0;
    const MAX_CAPACITY = 100;
    const loadPct = Math.min(100, Math.round((totalItems / MAX_CAPACITY) * 100));

    const animatedValue = useCountUp(totalValue, 2500);

    if (!analytics) {
        return (
            <div className="flex items-center justify-center h-[60vh] font-mono text-[var(--color-neon-cyan)]">
                <Activity className="w-6 h-6 animate-spin mr-3" /> LOADING_DASHBOARD...
            </div>
        );
    }

    return (
        <div className="relative max-w-[1400px] mx-auto">
            {/* ── Scanline Overlay ── */}
            <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_2px] opacity-[0.15]" />

            {/* ── GRID: 3 columns (2 main + 1 alerts sidebar) ── */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_300px] gap-5">

                {/* ═══ WIDGET A — ASSET POOL ═══ */}
                <GlassCard delay={0} className="xl:col-span-1">
                    <div className="flex items-start justify-between mb-4">
                        <GlitchHeader className="text-xs font-mono tracking-[0.2em] text-gray-500 uppercase">
                            ASSET_POOL
                        </GlitchHeader>
                        <div className="p-2 rounded-lg bg-[var(--color-neon-cyan)]/10 border border-[var(--color-neon-cyan)]/20">
                            <Coins className="w-4 h-4 text-[var(--color-neon-cyan)]" />
                        </div>
                    </div>
                    <div className="relative">
                        <p className="text-4xl font-black text-white tabular-nums tracking-tight">
                            {animatedValue.toLocaleString()}
                            <span className="text-base font-normal text-[var(--color-neon-cyan)] ml-2 drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]">Rp</span>
                        </p>
                        <p className="text-[10px] font-mono text-gray-600 mt-2">
                            Total inventory valuation • {totalItems} assets tracked
                        </p>
                        {/* Glow line */}
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-[var(--color-neon-cyan)]/60 via-transparent to-transparent" />
                    </div>
                </GlassCard>

                {/* ═══ WIDGET B — SYSTEM LOAD ═══ */}
                <GlassCard delay={0.1} className="xl:col-span-1">
                    <div className="flex items-start justify-between mb-4">
                        <GlitchHeader className="text-xs font-mono tracking-[0.2em] text-gray-500 uppercase">
                            SYSTEM_LOAD
                        </GlitchHeader>
                        <div className="p-2 rounded-lg bg-[var(--color-neon-purple)]/10 border border-[var(--color-neon-purple)]/20">
                            <Cpu className="w-4 h-4 text-[var(--color-neon-purple)]" />
                        </div>
                    </div>

                    <div className="flex items-end gap-4 mb-3">
                        <p className="text-4xl font-black text-white tabular-nums">{totalItems}</p>
                        <p className="text-sm font-mono text-gray-500 pb-1">/ {MAX_CAPACITY} capacity</p>
                    </div>

                    {/* Progress bar */}
                    <div className="relative h-3 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${loadPct}%` }}
                            transition={{ duration: 1.5, ease: 'easeOut' }}
                            className="h-full rounded-full bg-gradient-to-r from-[var(--color-neon-purple)] to-[var(--color-neon-cyan)]"
                            style={{ boxShadow: `0 0 15px ${NEON_PURPLE}80, 0 0 30px ${NEON_CYAN}40` }}
                        />
                        {/* Tick marks */}
                        {[25, 50, 75].map(p => (
                            <div key={p} className="absolute top-0 bottom-0 w-px bg-white/10" style={{ left: `${p}%` }} />
                        ))}
                    </div>
                    <div className="flex justify-between mt-2 text-[9px] font-mono text-gray-600">
                        <span>0%</span>
                        <span className={loadPct > 80 ? 'text-red-400' : 'text-[var(--color-neon-cyan)]'}>{loadPct}% UTILIZED</span>
                        <span>100%</span>
                    </div>
                </GlassCard>

                {/* ═══ WIDGET D — CRITICAL ALERTS (Right sidebar) ═══ */}
                <GlassCard delay={0.15} className="xl:row-span-3 border-red-500/20 bg-red-500/[0.02]">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <GlitchHeader className="text-xs font-mono tracking-[0.2em] text-red-400 uppercase font-bold">
                            CRITICAL_BREACHES
                        </GlitchHeader>
                    </div>
                    <div className="h-px bg-gradient-to-r from-red-500/50 to-transparent mb-4" />

                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {lowStockItems.length === 0 ? (
                            <p className="text-xs font-mono text-gray-600 text-center py-8">
                                <Shield className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
                                ALL_SYSTEMS_NOMINAL
                            </p>
                        ) : (
                            lowStockItems.map(item => (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{
                                        opacity: 1, x: 0,
                                        ...(item.stock === 0 ? { scale: [1, 1.02, 1] } : {}),
                                    }}
                                    transition={{
                                        duration: 0.3,
                                        ...(item.stock === 0 ? { scale: { repeat: Infinity, duration: 1.5 } } : {}),
                                    }}
                                    className={`p-3 rounded-xl border transition-colors ${item.stock === 0
                                        ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                                        : 'bg-white/[0.02] border-white/5 hover:border-amber-400/30'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <p className="text-xs font-bold text-white truncate flex-1 mr-2">{item.name}</p>
                                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${item.stock === 0
                                            ? 'bg-red-500/20 text-red-400 animate-pulse'
                                            : 'bg-amber-400/10 text-amber-400'
                                            }`}>
                                            {item.stock === 0 ? 'EMPTY' : `${item.stock} LEFT`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-[9px] font-mono text-gray-600">{item.category}</span>
                                        <span className="text-[9px] font-mono text-gray-500">Rp{item.price.toLocaleString('id-ID')}</span>
                                    </div>
                                    {/* Stock danger bar */}
                                    <div className="h-1 rounded-full bg-white/5 mt-2 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${item.stock === 0 ? 'bg-red-500' : 'bg-amber-400'}`}
                                            style={{ width: `${Math.max(5, (item.stock / 10) * 100)}%` }}
                                        />
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>

                    {lowStockItems.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-red-500/10 flex justify-between items-center">
                            <span className="text-[9px] font-mono text-red-400/60">{lowStockItems.length} BREACH(ES)</span>
                            <ChevronRight className="w-4 h-4 text-red-400/40" />
                        </div>
                    )}
                </GlassCard>

                {/* ═══ WIDGET C — HOLO-GRAPH ═══ */}
                <GlassCard delay={0.2} className="xl:col-span-2">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <GlitchHeader className="text-xs font-mono tracking-[0.2em] text-gray-500 uppercase">
                                HOLO_GRAPH
                            </GlitchHeader>
                            <p className="text-[9px] font-mono text-gray-600 mt-1">Asset value trend • 8-week projection</p>
                        </div>
                        <div className="flex gap-4 text-[9px] font-mono">
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--color-neon-cyan)]" />VALUE</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--color-neon-purple)]" />ITEMS</span>
                        </div>
                    </div>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={analytics.stockTrends}>
                                <defs>
                                    <linearGradient id="holoGradCyan" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={NEON_CYAN} stopOpacity={0.35} />
                                        <stop offset="100%" stopColor={NEON_CYAN} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="holoGradPurple" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={NEON_PURPLE} stopOpacity={0.2} />
                                        <stop offset="100%" stopColor={NEON_PURPLE} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="week" tick={{ fill: '#444', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#444', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={45} />
                                <Tooltip content={<CyberTooltip />} />
                                <Area type="monotone" dataKey="assets" name="Value" stroke={NEON_CYAN} strokeWidth={2} fill="url(#holoGradCyan)" dot={false} activeDot={{ r: 4, fill: NEON_CYAN, stroke: '#000', strokeWidth: 2 }} />
                                <Area type="monotone" dataKey="items" name="Items" stroke={NEON_PURPLE} strokeWidth={1.5} fill="url(#holoGradPurple)" dot={false} activeDot={{ r: 3, fill: NEON_PURPLE, stroke: '#000', strokeWidth: 2 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </GlassCard>

                {/* ═══ WIDGET E — TERMINAL LOG ═══ */}
                <GlassCard delay={0.3} className="xl:col-span-2">
                    <div className="flex items-center gap-2 mb-3">
                        <TerminalIcon className="w-4 h-4 text-[var(--color-neon-cyan)]" />
                        <GlitchHeader className="text-xs font-mono tracking-[0.2em] text-gray-500 uppercase">
                            TERMINAL_LOG
                        </GlitchHeader>
                        <span className="ml-auto text-[9px] font-mono text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                        </span>
                    </div>

                    <div
                        ref={logRef}
                        className="bg-black/60 rounded-xl border border-white/5 p-4 font-mono text-xs max-h-52 overflow-y-auto space-y-1"
                    >
                        {terminalLogs.length === 0 ? (
                            <p className="text-gray-600 text-center py-4">LOG_STREAM: <span className="text-[var(--color-neon-cyan)]">AWAITING_DATA</span></p>
                        ) : (
                            [...terminalLogs].reverse().map((tx, i) => (
                                <motion.div
                                    key={tx.transaction_id || i}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i < 5 ? i * 0.06 : 0 }}
                                    className="flex gap-3"
                                >
                                    <span className="text-gray-600 shrink-0">{formatLogTime(tx.timestamp)}</span>
                                    <span className={logColor(tx.type)}>{formatLogMsg(tx)}</span>
                                </motion.div>
                            ))
                        )}
                        <div className="flex items-center gap-1 mt-2 text-[var(--color-neon-cyan)]">
                            <span>&gt;</span>
                            <span className="animate-[flicker_1s_infinite]">█</span>
                        </div>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
