import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart, Area, ResponsiveContainer,
    XAxis, YAxis, Tooltip
} from 'recharts';
import {
    TrendingUp, Activity, Target, AlertTriangle,
    BarChart3, Calendar, Cpu, ShoppingBag, PackageX, DollarSign
} from 'lucide-react';
import api from '../api';

const NEON_CYAN = '#00f3ff';
const NEON_PURPLE = '#bc13fe';

/* Custom Tooltip */
function CyberTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-black/90 border border-[var(--color-neon-cyan)]/30 backdrop-blur-xl rounded-lg px-4 py-3 shadow-[0_0_20px_rgba(0,243,255,0.15)]">
            <p className="text-[10px] font-mono text-gray-500 mb-1">{label}</p>
            {payload.map((entry, i) => (
                <p key={i} className="text-sm font-mono font-bold flex items-center gap-2" style={{ color: entry.color }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                    {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString('id-ID') : entry.value}
                </p>
            ))}
        </div>
    );
}

/* Stat Mini Card */
function MiniStat({ icon: Icon, label, value, accent, prefix = '' }) {
    return (
        <motion.div 
            whileHover={{ y: -5, scale: 1.02 }}
            className="group flex flex-col justify-center bg-[rgba(8,8,12,0.7)] backdrop-blur-xl border border-white/5 rounded-2xl px-5 py-4 overflow-hidden relative cursor-pointer"
        >
            <div className={`absolute inset-0 bg-gradient-to-br from-transparent to-[${accent}]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className="relative z-10 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:border-[var(--color-neon-cyan)]/30 transition-colors">
                    <Icon className="w-6 h-6" style={{ color: accent }} />
                </div>
                <div>
                    <p className="text-[10px] font-mono tracking-widest text-gray-500 uppercase mb-1">{label}</p>
                    <p className="text-xl sm:text-2xl font-bold text-white tabular-nums tracking-tight">
                        {prefix}<span className="group-hover:text-[var(--color-neon-cyan)] transition-colors">{value}</span>
                    </p>
                </div>
            </div>
        </motion.div>
    );
}

export default function Analytics() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('monthly'); // daily, weekly, monthly, yearly

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/analytics?period=${period}`);
                const jsonData = await res.json();
                setData(jsonData);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [period]);

    return (
        <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <BarChart3 className="w-6 h-6 text-[var(--color-neon-cyan)]" />
                        Sales Analytics
                    </h2>
                    <p className="text-xs font-mono text-gray-600 mt-1">Real-time revenue & performance tracking</p>
                </div>

                <div className="relative group">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Calendar className="w-4 h-4 text-[var(--color-neon-purple)]" />
                    </div>
                    <select
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                        className="bg-[rgba(8,8,12,0.8)] border border-[var(--color-neon-purple)]/40 text-white text-sm font-mono rounded-xl focus:ring-[var(--color-neon-purple)] focus:border-[var(--color-neon-purple)] block w-full pl-10 p-2.5 hover:bg-[var(--color-neon-purple)]/10 transition-colors cursor-pointer appearance-none outline-none pr-8"
                    >
                        <option value="daily">Harian (24 Jam)</option>
                        <option value="weekly">Mingguan (7 Hari)</option>
                        <option value="monthly">Bulanan (30 Hari)</option>
                        <option value="yearly">Tahunan (12 Bulan)</option>
                    </select>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {loading || !data ? (
                    <motion.div 
                        key="loading"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center h-[50vh] font-mono text-[var(--color-neon-cyan)] gap-4"
                    >
                        <Activity className="w-8 h-8 animate-spin" /> 
                        <p className="tracking-widest animate-pulse">FETCHING_SALES_DATA...</p>
                    </motion.div>
                ) : (
                    <motion.div 
                        key="content"
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="space-y-8"
                    >
                        {/* ─── AI INSIGHTS PANEL ─── */}
                        {data.aiInsights && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
                                className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[rgba(188,19,254,0.1)] to-[rgba(0,243,255,0.05)] border border-[var(--color-neon-purple)]/30 p-6"
                            >
                                {/* Background grid effect */}
                                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50" />
                                
                                <div className="relative z-10 flex items-start gap-4">
                                    <div className="p-3 bg-black/40 rounded-xl border border-[var(--color-neon-purple)]/50 backdrop-blur-md">
                                        <Cpu className="w-6 h-6 text-[var(--color-neon-purple)] animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-mono font-bold text-[var(--color-neon-purple)] tracking-widest uppercase mb-2 flex items-center gap-2">
                                            Hermes AI Analysis
                                            <span className="w-2 h-2 rounded-full bg-[var(--color-neon-cyan)] animate-ping" />
                                        </h3>
                                        <p className="text-sm md:text-base text-gray-300 font-mono leading-relaxed">
                                            "{data.aiInsights}"
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* ─── MINI STATS ROW ─── */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <MiniStat icon={DollarSign} label="Total Revenue" value={data.salesStats.total_revenue.toLocaleString('id-ID')} prefix="Rp " accent={NEON_CYAN} />
                            <MiniStat icon={ShoppingBag} label="Units Sold" value={data.salesStats.total_items} accent={NEON_PURPLE} />
                            <MiniStat icon={Activity} label="Total Transactions" value={data.salesStats.tx_count} accent="#facc15" />
                            <MiniStat icon={Target} label="Avg Order Value" value={data.salesStats.avg_order_value.toLocaleString('id-ID')} prefix="Rp " accent="#22d3ee" />
                        </div>

                        {/* ─── SALES REVENUE CHART ─── */}
                        <motion.div
                            whileHover={{ boxShadow: "0 0 30px rgba(0, 243, 255, 0.05)" }}
                            className="bg-[rgba(8,8,12,0.7)] backdrop-blur-xl border border-white/5 rounded-2xl p-6 overflow-hidden relative transition-shadow duration-500"
                        >
                            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.12)_50%)] bg-[length:100%_2px] opacity-20 rounded-2xl" />
                            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6 relative z-10">
                                <TrendingUp className="w-4 h-4 text-[var(--color-neon-cyan)]" />
                                Revenue & Volume Trends
                                <span className="ml-auto text-[10px] font-mono text-gray-500 uppercase px-3 py-1 bg-white/5 rounded-full border border-white/10">
                                    {period} VIEW
                                </span>
                            </h3>
                            <div className="h-[300px] w-full relative z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data.stockTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                                        <XAxis dataKey="week" tick={{ fill: '#666', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis yAxisId="left" tick={{ fill: '#666', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} tickFormatter={(v) => `Rp${v/1000}k`} />
                                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#666', fontSize: 10, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CyberTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2, strokeDasharray: '4 4' }} />
                                        
                                        <Area yAxisId="left" type="monotone" dataKey="assets" name="Revenue (Rp)" stroke={NEON_CYAN} strokeWidth={3} fill="url(#gradCyan)" dot={false} activeDot={{ r: 6, fill: '#000', stroke: NEON_CYAN, strokeWidth: 2 }} />
                                        <Area yAxisId="right" type="monotone" dataKey="items" name="Units Sold" stroke={NEON_PURPLE} strokeWidth={3} fill="url(#gradPurple)" dot={false} activeDot={{ r: 6, fill: '#000', stroke: NEON_PURPLE, strokeWidth: 2 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </motion.div>

                        {/* ─── TABLES ROW ─── */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* TOP 5 SELLERS */}
                            <motion.div 
                                whileHover={{ scale: 1.01 }}
                                className="bg-[rgba(8,8,12,0.7)] backdrop-blur-xl border border-white/5 hover:border-[var(--color-neon-cyan)]/30 rounded-2xl p-6 transition-all duration-300"
                            >
                                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6">
                                    <TrendingUp className="w-4 h-4 text-[var(--color-neon-cyan)]" />
                                    Top 5 Fast-Moving Items
                                </h3>
                                <div className="space-y-4">
                                    {data.topSellers && data.topSellers.length > 0 ? (
                                        data.topSellers.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 rounded-md bg-[var(--color-neon-cyan)]/10 text-[var(--color-neon-cyan)] flex items-center justify-center font-bold text-xs">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-white group-hover:text-[var(--color-neon-cyan)] transition-colors">{item.item_name}</p>
                                                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">{item.total_sold} UNITS SOLD</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-mono font-bold text-[var(--color-neon-cyan)]">
                                                        Rp {item.total_revenue.toLocaleString('id-ID')}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-8 text-center text-xs font-mono text-gray-500">
                                            NO SALES DATA FOUND
                                        </div>
                                    )}
                                </div>
                            </motion.div>

                            {/* DEAD STOCK */}
                            <motion.div 
                                whileHover={{ scale: 1.01 }}
                                className="bg-[rgba(8,8,12,0.7)] backdrop-blur-xl border border-white/5 hover:border-red-500/30 rounded-2xl p-6 transition-all duration-300"
                            >
                                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-6">
                                    <PackageX className="w-4 h-4 text-red-400" />
                                    Dead Stock Risk (30 Days Inactive)
                                </h3>
                                <div className="space-y-4">
                                    {data.deadStock && data.deadStock.length > 0 ? (
                                        data.deadStock.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-red-500/10 transition-colors group">
                                                <div>
                                                    <p className="text-sm font-bold text-white group-hover:text-red-400 transition-colors">{item.name}</p>
                                                    <p className="text-[10px] text-gray-500 font-mono mt-0.5 flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3 text-red-500" /> 
                                                        {item.stock} UNITS STUCK
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500 font-mono">LOCKED CAPITAL</p>
                                                    <p className="text-sm font-mono font-bold text-red-400">
                                                        Rp {item.value.toLocaleString('id-ID')}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-8 text-center text-xs font-mono text-emerald-500">
                                            ALL ITEMS ARE MOVING WELL
                                        </div>
                                    )}
                                </div>
                            </motion.div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
