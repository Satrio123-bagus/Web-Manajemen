import { useState, useEffect, useMemo } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import {
    AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer,
    XAxis, YAxis, Tooltip, Legend
} from 'recharts';
import {
    TrendingUp, PieChart as PieIcon, Activity, Layers,
    Shield, Zap, BarChart3
} from 'lucide-react';

const NEON_CYAN = '#00f3ff';
const NEON_PURPLE = '#bc13fe';
const COLORS = [NEON_CYAN, NEON_PURPLE, '#facc15', '#f97316', '#22d3ee', '#a855f7', '#ef4444', '#10b981'];

/* Custom Tooltip */
function CyberTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-black/90 border border-[var(--color-neon-cyan)]/30 backdrop-blur-xl rounded-lg px-4 py-3 shadow-[0_0_20px_rgba(0,243,255,0.15)]">
            <p className="text-[10px] font-mono text-gray-500 mb-1">{label}</p>
            {payload.map((entry, i) => (
                <p key={i} className="text-sm font-mono font-bold" style={{ color: entry.color }}>
                    {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                </p>
            ))}
        </div>
    );
}

/* Stat Mini Card */
function MiniStat({ icon: Icon, label, value, accent }) {
    return (
        <div className="flex items-center gap-3 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
            <Icon className="w-5 h-5 shrink-0" style={{ color: accent }} />
            <div>
                <p className="text-[9px] font-mono tracking-widest text-gray-600 uppercase">{label}</p>
                <p className="text-lg font-bold text-white tabular-nums">{value}</p>
            </div>
        </div>
    );
}

export default function Analytics() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics')
            .then(r => r.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center h-[60vh] font-mono text-[var(--color-neon-cyan)]">
                <Activity className="w-6 h-6 animate-spin mr-3" /> LOADING_ANALYTICS...
            </div>
        );
    }

    return (
        <div className="max-w-[1400px] mx-auto space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <BarChart3 className="w-6 h-6 text-[var(--color-neon-cyan)]" />
                    Analytics Overview
                </h2>
                <p className="text-xs font-mono text-gray-600 mt-1">Real-time data from INSERT3COINS Core</p>
            </div>

            {/* Mini stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniStat icon={Layers} label="Total Items" value={data.totalItems} accent={NEON_CYAN} />
                <MiniStat icon={Zap} label="Total Value" value={`Rp${data.totalStockValue.toLocaleString('id-ID')}`} accent={NEON_PURPLE} />
                <MiniStat icon={Shield} label="Total Stock" value={data.totalStock} accent="#22d3ee" />
                <MiniStat icon={Activity} label="Low Stock" value={data.lowStockCount} accent="#facc15" />
            </div>

            {/* Charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Area Chart — Sales Revenue History */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-[rgba(8,8,12,0.7)] backdrop-blur-xl border border-white/5 rounded-2xl p-6 overflow-hidden relative"
                >
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.12)_50%)] bg-[length:100%_2px] opacity-20 rounded-2xl" />
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6 relative z-10">
                        <TrendingUp className="w-4 h-4 text-[var(--color-neon-cyan)]" />
                        Sales Revenue History
                        <span className="ml-auto text-[9px] font-mono text-gray-600">LAST 7 DAYS</span>
                    </h3>
                    <div className="h-64 relative z-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.stockTrends}>
                                <defs>
                                    <linearGradient id="gradCyan" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={NEON_CYAN} stopOpacity={0.4} />
                                        <stop offset="100%" stopColor={NEON_CYAN} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={NEON_PURPLE} stopOpacity={0.3} />
                                        <stop offset="100%" stopColor={NEON_PURPLE} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="week" tick={{ fill: '#555', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#555', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={50} />
                                <Tooltip content={<CyberTooltip />} />
                                <Area type="monotone" dataKey="assets" name="Revenue (Rp)" stroke={NEON_CYAN} strokeWidth={2} fill="url(#gradCyan)" dot={false} activeDot={{ r: 4, fill: NEON_CYAN, stroke: '#000', strokeWidth: 2 }} />
                                <Area type="monotone" dataKey="items" name="Units Sold" stroke={NEON_PURPLE} strokeWidth={2} fill="url(#gradPurple)" dot={false} activeDot={{ r: 4, fill: NEON_PURPLE, stroke: '#000', strokeWidth: 2 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Pie Chart — Category Distribution */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-[rgba(8,8,12,0.7)] backdrop-blur-xl border border-white/5 rounded-2xl p-6 overflow-hidden relative"
                >
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.12)_50%)] bg-[length:100%_2px] opacity-20 rounded-2xl" />
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6 relative z-10">
                        <PieIcon className="w-4 h-4 text-[var(--color-neon-purple)]" />
                        Category Distribution
                        <span className="ml-auto text-[9px] font-mono text-gray-600">{data.categoryDistribution.length} CATEGORIES</span>
                    </h3>
                    <div className="h-64 relative z-10 flex items-center">
                        <ResponsiveContainer width="60%" height="100%">
                            <PieChart>
                                <Pie
                                    data={data.categoryDistribution}
                                    dataKey="count"
                                    nameKey="name"
                                    cx="50%" cy="50%"
                                    innerRadius={50} outerRadius={80}
                                    strokeWidth={2}
                                    stroke="rgba(0,0,0,0.5)"
                                >
                                    {data.categoryDistribution.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CyberTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                        {/* Legend */}
                        <div className="w-[40%] space-y-2 pl-2">
                            {data.categoryDistribution.map((item, i) => (
                                <div key={item.name} className="flex items-center gap-2 text-xs font-mono">
                                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                    <span className="text-gray-400 truncate">{item.name}</span>
                                    <span className="ml-auto text-white font-bold">{item.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Rarity Breakdown */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="bg-[rgba(8,8,12,0.7)] backdrop-blur-xl border border-white/5 rounded-2xl p-6 lg:col-span-2 overflow-hidden relative"
                >
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.12)_50%)] bg-[length:100%_2px] opacity-20 rounded-2xl" />
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6 relative z-10">
                        <Shield className="w-4 h-4 text-amber-400" />
                        Rarity Breakdown
                    </h3>
                    <div className="flex gap-6 relative z-10">
                        {data.rarityDistribution.map(r => {
                            const pct = Math.round((r.count / data.totalItems) * 100);
                            const color = r.name === 'LEGENDARY' ? '#facc15' : r.name === 'RARE' ? NEON_CYAN : '#9ca3af';
                            return (
                                <div key={r.name} className="flex-1">
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-xs font-mono tracking-widest" style={{ color }}>{r.name}</span>
                                        <span className="text-lg font-black text-white">{r.count}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                            transition={{ duration: 1, ease: 'easeOut' }}
                                            className="h-full rounded-full shadow-[0_0_10px_currentColor]"
                                            style={{ backgroundColor: color }}
                                        />
                                    </div>
                                    <p className="text-[10px] font-mono text-gray-600 mt-1">{pct}%</p>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
