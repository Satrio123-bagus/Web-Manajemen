import { useMemo, useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
    Coins, Package, AlertTriangle, TrendingUp, Trash2,
    Edit3, Plus, X, Save, Search, ChevronDown, DollarSign, Wrench
} from 'lucide-react';
import CortexActionCenter from '../components/CortexActionCenter';

/* ═══════════════════════════════════════════════════════════
   RARITY CONFIG
   ═══════════════════════════════════════════════════════════ */
const RARITY_STYLE = {
    BIASA:  { text: 'text-gray-400',                       border: 'border-gray-500/40',                    bg: 'bg-gray-500/10',                    dot: 'bg-gray-400' },
    LANGKA: { text: 'text-amber-400',                      border: 'border-amber-400/40',                   bg: 'bg-amber-400/10',                   dot: 'bg-amber-400' },
};

function stockStatus(stock) {
    if (stock <= 0) return { label: 'OUT_OF_STOCK', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-500' };
    if (stock < 2) return { label: 'LOW_STOCK', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', dot: 'bg-amber-400' };
    return { label: 'IN_STOCK', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', dot: 'bg-emerald-400' };
}

/* ═══════════════════════════════════════════════════════════
   STAT CARD
   ═══════════════════════════════════════════════════════════ */
function StatCard({ icon: Icon, label, value, suffix, accent, delay = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay }}
            className="relative group"
        >
            {/* Holographic border glow */}
            <div className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm`} />
            <div className={`absolute -inset-px rounded-2xl bg-gradient-to-br ${accent} opacity-30 group-hover:opacity-60 transition-opacity duration-500`} />

            <div className="relative bg-[rgba(8,8,12,0.85)] backdrop-blur-xl rounded-2xl p-6 border border-white/5 group-hover:border-transparent transition-all duration-300 overflow-hidden">
                {/* Scanline overlay */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_2px] opacity-20 rounded-2xl" />

                <div className="relative z-10 flex items-start justify-between">
                    <div>
                        <p className="text-[10px] font-mono tracking-[0.2em] text-gray-500 uppercase mb-3">{label}</p>
                        <p className="text-3xl font-black tracking-tight text-white tabular-nums">
                            {value}
                            {suffix && <span className="text-sm font-normal text-gray-500 ml-1">{suffix}</span>}
                        </p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 group-hover:border-white/20 transition-colors">
                        <Icon className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors drop-shadow-[0_0_6px_rgba(255,255,255,0.3)]" />
                    </div>
                </div>

                {/* Bottom accent line */}
                <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r ${accent} opacity-40 group-hover:opacity-100 transition-opacity duration-300`} />
            </div>
        </motion.div>
    );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD (exported)
   ═══════════════════════════════════════════════════════════ */
export default function Dashboard({ items, meta, onPageChange, limit, onLimitChange, onDelete, onEdit, onAdd, onSell, onAssemble, isDeleting, onSearch }) {
    const [search, setSearch] = useState('');

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (onSearch) onSearch(search);
        }, 300);
        return () => clearTimeout(timer);
    }, [search, onSearch]);
    const [sortKey, setSortKey] = useState(null);
    const [sortDir, setSortDir] = useState('asc');

    /* ── Stats ── */
    const stats = useMemo(() => {
        const totalAssets = items.reduce((s, i) => s + i.price * i.stock, 0);
        const totalItems = items.length;
        const lowStock = items.filter(i => i.stock < 2).length;
        return { totalAssets, totalItems, lowStock };
    }, [items]);

    const wipItems = useMemo(() => items.filter(i => i.condition === 'WIP'), [items]);

    /* ── Filter + Sort ── */
    const filtered = useMemo(() => {
        // Items are already filtered by backend
        let result = items;
        if (sortKey) {
            result = [...result].sort((a, b) => {
                const av = a[sortKey], bv = b[sortKey];
                const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }
        return result;
    }, [items, sortKey, sortDir]);

    const toggleSort = (key) => {
        if (sortKey === key) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    /* ── Render ── */
    return (
        <div className="max-w-[1400px] mx-auto space-y-8">

            {/* ═══ STAT CARDS ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    icon={Coins} label="Total Assets" value={stats.totalAssets.toLocaleString()} suffix="Rp"
                    accent="from-[var(--color-neon-cyan)] to-blue-500" delay={0}
                />
                <StatCard
                    icon={Package} label="System Load" value={meta ? meta.total : stats.totalItems} suffix="ITEMS"
                    accent="from-[var(--color-neon-purple)] to-pink-500" delay={0.1}
                />
                <StatCard
                    icon={AlertTriangle} label="Critical Alerts" value={stats.lowStock} suffix="LOW"
                    accent="from-amber-400 to-red-500" delay={0.2}
                />
            </div>

            {/* ═══ MAIN CONTENT GRID ═══ */}
            <div className="space-y-8">
                
                {/* ═══ QC / WORK IN PROGRESS QUEUE ═══ */}
                {wipItems.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-[#1a1305]/90 border border-amber-500/30 rounded-2xl p-6 relative overflow-hidden backdrop-blur-xl shadow-[0_8px_30px_rgba(251,191,36,0.1)]"
                    >
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(251,191,36,0.03)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px]" />
                        <div className="relative z-10 flex flex-col md:flex-row items-start gap-4">
                            <div className="p-3 bg-amber-500/20 rounded-xl shrink-0 border border-amber-500/30">
                                <Wrench className="w-6 h-6 text-amber-400 animate-pulse" />
                            </div>
                            <div className="flex-1 w-full">
                                <h3 className="text-lg font-bold text-amber-400 mb-1 font-mono tracking-wide">BENGKEL / QUALITY CONTROL</h3>
                                <p className="text-sm text-amber-400/70 mb-4 max-w-2xl">
                                    Terdapat <span className="font-bold text-white">{wipItems.length} barang</span> yang belum selesai diproses (WIP). Barang-barang ini otomatis <strong className="text-red-400">dikunci dari penjualan</strong> oleh sistem Cortex sampai diperbaiki/selesai dirakit.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                    {wipItems.map(item => (
                                        <div key={item.id} className="bg-black/60 border border-amber-500/20 p-3 rounded-xl flex justify-between items-center group cursor-pointer hover:border-amber-400/60 hover:bg-amber-900/20 transition-all shadow-[inset_0_0_15px_rgba(251,191,36,0.05)]" onClick={() => onEdit(item)}>
                                            <div className="min-w-0 pr-2">
                                                <p className="font-bold text-amber-300 text-sm truncate group-hover:text-amber-200">{item.name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-1.5 py-0.5 rounded">{item.id}</span>
                                                    <span className="text-[10px] text-gray-400 font-mono">Stok: {item.stock}</span>
                                                </div>
                                            </div>
                                            <div className="shrink-0 p-1.5 bg-white/5 rounded-lg group-hover:bg-amber-400/20 transition-colors">
                                                <Edit3 className="w-4 h-4 text-gray-500 group-hover:text-amber-400 transition-colors" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ═══ TABLE SECTION (Full Width) ═══ */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="relative"
                >
                    {/* Table header bar */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
                        <div>
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-[var(--color-neon-cyan)]" />
                                Inventory Registry
                            </h3>
                            <p className="text-xs font-mono text-gray-600 mt-1">
                                {meta ? `Showing page ${meta.page} of ${meta.totalPages || 1} (${meta.total} records)` : `${filtered.length} of ${items.length} records displayed`}
                            </p>
                        </div>
                        <div className="flex gap-3 items-center">
                            {/* Search */}
                            <div className="relative flex items-center bg-white/5 border border-white/10 rounded-lg h-9 px-3 hover:border-[var(--color-neon-cyan)]/30 transition-colors group">
                                <Search className="w-4 h-4 text-gray-600 group-hover:text-[var(--color-neon-cyan)] transition-colors mr-2" />
                                <input
                                    type="text" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="Filter items..."
                                    className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-600 w-40 font-mono"
                                />
                            </div>
                            {/* Add button */}
                            <motion.button
                                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                onClick={onAdd}
                                className="h-9 px-5 rounded-lg bg-[var(--color-neon-purple)] text-white text-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(188,19,254,0.3)] hover:shadow-[0_0_25px_rgba(188,19,254,0.5)] transition-all border border-white/10"
                            >
                                <Plus className="w-4 h-4" /> NEW_ENTRY
                            </motion.button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="rounded-2xl border border-white/5 overflow-hidden bg-[rgba(8,8,12,0.6)] backdrop-blur-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        {[
                                            { key: 'id', label: 'ID' },
                                            { key: 'name', label: 'ITEM NAME' },
                                            { key: 'bab', label: 'BAB' },
                                            { key: 'sub_bab', label: 'SUB BAB' },
                                            { key: 'location', label: 'LOKASI' },
                                            { key: 'rarity', label: 'RARITY' },
                                            { key: 'price', label: 'UNIT PRICE' },
                                            { key: 'stock', label: 'STOCK LEVEL' },
                                            { key: null, label: 'STATUS' },
                                            { key: null, label: 'ACTIONS' },
                                        ].map(({ key, label }, i) => (
                                            <th
                                                key={i}
                                                onClick={key ? () => toggleSort(key) : undefined}
                                                className={`px-5 py-4 text-left text-[10px] font-mono tracking-[0.15em] text-gray-500 uppercase whitespace-nowrap ${key ? 'cursor-pointer hover:text-[var(--color-neon-cyan)] transition-colors select-none' : ''}`}
                                            >
                                                <span className="flex items-center gap-1">
                                                    {label}
                                                    {key && sortKey === key && (
                                                        <ChevronDown className={`w-3 h-3 transition-transform ${sortDir === 'desc' ? 'rotate-180' : ''}`} />
                                                    )}
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence mode="popLayout">
                                        {filtered.map((item, idx) => {
                                            const status = stockStatus(item.stock);
                                            const rarity = RARITY_STYLE[item.rarity] || RARITY_STYLE.BIASA;
                                            const deleting = isDeleting === item.id;

                                            return (
                                                <motion.tr
                                                    key={item.id}
                                                    layout
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: deleting ? 0.3 : 1, x: 0 }}
                                                    exit={{ opacity: 0, x: 20, transition: { duration: 0.3 } }}
                                                    transition={{ duration: 0.3, delay: idx * 0.02 }}
                                                    className={`border-b border-white/[0.03] transition-all duration-200 group/row
                          ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'}
                          hover:bg-[var(--color-neon-cyan)]/[0.06] hover:shadow-[inset_0_0_30px_rgba(0,243,255,0.04)]`}
                                                >
                                                    {/* ID */}
                                                    <td className="px-5 py-4 font-mono text-xs text-gray-600">
                                                        {item.id}
                                                    </td>

                                                    {/* NAME */}
                                                    <td className="px-5 py-4">
                                                        <span className="font-bold text-white group-hover/row:text-[var(--color-neon-cyan)] transition-colors flex items-center gap-2">
                                                            {item.name}
                                                            {item.condition === 'WIP' && (
                                                                <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] rounded font-mono font-bold tracking-widest uppercase shadow-[0_0_10px_rgba(251,191,36,0.2)]">WIP</span>
                                                            )}
                                                        </span>
                                                    </td>

                                                    {/* BAB (Main Category) */}
                                                    <td className="px-5 py-4">
                                                        <span className="px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest text-[var(--color-neon-purple)] bg-[var(--color-neon-purple)]/10 border border-[var(--color-neon-purple)]/20 uppercase">
                                                            {item.bab || item.category}
                                                        </span>
                                                    </td>

                                                    {/* SUB_BAB (Sub Category) */}
                                                    <td className="px-5 py-4">
                                                        <span className="px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest text-[var(--color-neon-cyan)] bg-[var(--color-neon-cyan)]/10 border border-[var(--color-neon-cyan)]/20 uppercase">
                                                            {item.sub_bab || 'N/A'}
                                                        </span>
                                                    </td>

                                                    {/* LOKASI */}
                                                    <td className="px-5 py-4">
                                                        <span className="px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest text-[var(--color-neon-purple)] bg-[var(--color-neon-purple)]/10 border border-[var(--color-neon-purple)]/20 uppercase">
                                                            {item.location || 'Belum Ditentukan'}
                                                        </span>
                                                    </td>

                                                    {/* RARITY */}
                                                    <td className="px-5 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest uppercase border ${rarity.text} ${rarity.bg} ${rarity.border}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${rarity.dot}`} />
                                                            {item.rarity === 'LANGKA' ? 'Remote Langka' : 'Remote Biasa'}
                                                        </span>
                                                    </td>

                                                    {/* PRICE */}
                                                    <td className="px-5 py-4">
                                                        <span className="font-mono text-white group-hover/row:text-[var(--color-neon-cyan)] transition-colors">
                                                            {Number(item.price).toLocaleString('id-ID')}
                                                            <span className="text-[10px] text-gray-400 ml-1 font-normal uppercase tracking-tighter">Rp</span>
                                                        </span>
                                                    </td>

                                                    {/* STOCK */}
                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className={`font-mono font-bold tabular-nums ${item.stock < 2 ? 'text-amber-400' : 'text-white'}`}>
                                                                {item.stock}
                                                            </span>
                                                            {/* Mini bar */}
                                                            <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-500 ${item.stock < 2 ? 'bg-amber-400' : 'bg-[var(--color-neon-cyan)]'}`}
                                                                    style={{ width: `${Math.min(100, (item.stock / 50) * 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* STATUS */}
                                                    <td className="px-5 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest border ${status.color} ${status.bg} ${status.border}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${item.stock < 2 ? 'animate-pulse' : ''}`} />
                                                            {status.label}
                                                        </span>
                                                    </td>

                                                    {/* ACTIONS */}
                                                    <td className="px-5 py-4">
                                                        <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                            {/* Quick Sell */}
                                                            {item.price > 0 && (
                                                                <motion.button
                                                                    whileHover={item.stock > 0 && item.condition !== 'WIP' ? { scale: 1.1 } : {}} whileTap={item.stock > 0 && item.condition !== 'WIP' ? { scale: 0.9 } : {}}
                                                                    onClick={() => item.stock > 0 && item.condition !== 'WIP' && onSell(item.id)}
                                                                    disabled={item.stock <= 0 || item.condition === 'WIP'}
                                                                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-all border ${item.stock > 0 && item.condition !== 'WIP'
                                                                        ? 'text-amber-400 border-amber-400/30 hover:bg-amber-400/10 hover:border-amber-400/60 hover:shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                                                                        : 'text-gray-600 border-gray-700/30 bg-gray-800/30 cursor-not-allowed'
                                                                        }`}
                                                                    title={item.condition === 'WIP' ? 'Terkunci: Masih WIP (Belum Selesai)' : (item.stock > 0 ? `Sell 1x ${item.name}` : 'Out of stock')}
                                                                >
                                                                    <DollarSign className="w-3 h-3" />
                                                                    {item.condition === 'WIP' ? 'LOCKED' : (item.stock > 0 ? 'SELL' : 'EMPTY')}
                                                                </motion.button>
                                                            )}
                                                            {/* Assemble */}
                                                            {(item.bab === 'WIP' || item.category === 'WIP' || item.bab === 'SPARE_PART' || item.category === 'SPARE_PART' || item.name.toLowerCase().includes('casing') || item.name.toLowerCase().includes('bahan')) && (
                                                                <motion.button
                                                                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                                                    onClick={() => onAssemble(item)}
                                                                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-all border text-[var(--color-neon-purple)] border-[var(--color-neon-purple)]/30 hover:bg-[var(--color-neon-purple)]/10 hover:border-[var(--color-neon-purple)]/60 hover:shadow-[0_0_12px_rgba(188,19,254,0.2)]"
                                                                    title="Rakit / Assemble"
                                                                >
                                                                    <Package className="w-3 h-3" />
                                                                    RAKIT
                                                                </motion.button>
                                                            )}
                                                            {/* Edit */}
                                                            <motion.button
                                                                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                                                onClick={() => onEdit(item)}
                                                                className="p-2 rounded-lg text-gray-500 hover:text-[var(--color-neon-cyan)] hover:bg-[var(--color-neon-cyan)]/10 transition-all"
                                                                title="Edit"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </motion.button>
                                                            {/* Delete */}
                                                            <motion.button
                                                                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                                                onClick={() => onDelete(item.id)}
                                                                className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </motion.button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            );
                                        })}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        {/* Empty state */}
                        {filtered.length === 0 && (
                            <div className="py-16 text-center font-mono text-gray-600">
                                <p className="text-lg mb-1">System.Query.Result: <span className="text-[var(--color-neon-cyan)]">NULL</span></p>
                                <p className="text-xs">No records match the current filter criteria</p>
                            </div>
                        )}

                        {/* Table footer & Pagination Controls */}
                        <div className="px-5 py-3 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-4">
                                <p className="text-[10px] font-mono text-gray-600">
                                    TOTAL_ASSETS: <span className="text-[var(--color-neon-cyan)]">{stats.totalAssets.toLocaleString()} Rp</span>
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-gray-600">LIMIT:</span>
                                    <select 
                                        value={limit || 50} 
                                        onChange={(e) => onLimitChange(Number(e.target.value))}
                                        className="bg-[#0a0a0c] border border-white/10 rounded text-[10px] font-mono text-white p-1 focus:outline-none focus:border-[var(--color-neon-cyan)]"
                                    >
                                        <option value="10">10</option>
                                        <option value="50">50</option>
                                        <option value="100">100</option>
                                    </select>
                                </div>
                            </div>
                            
                            {meta && meta.totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onPageChange(meta.page - 1)}
                                        disabled={meta.page <= 1}
                                        className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs text-white hover:bg-white/10 hover:border-[var(--color-neon-cyan)] disabled:opacity-30 transition-all font-mono uppercase"
                                    >
                                        &lt; Prev
                                    </button>
                                    <span className="text-[10px] text-[var(--color-neon-cyan)] font-mono tracking-widest px-2">
                                        [{String(meta.page).padStart(2, '0')} / {String(meta.totalPages).padStart(2, '0')}]
                                    </span>
                                    <button
                                        onClick={() => onPageChange(meta.page + 1)}
                                        disabled={meta.page >= meta.totalPages}
                                        className="px-3 py-1 bg-white/5 border border-white/10 rounded text-xs text-white hover:bg-white/10 hover:border-[var(--color-neon-cyan)] disabled:opacity-30 transition-all font-mono uppercase"
                                    >
                                        Next &gt;
                                    </button>
                                </div>
                            )}
                            
                            <p className="text-[10px] font-mono text-gray-600">
                                RECORDS: {filtered.length}/{meta ? meta.total : items.length}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* ═══ CORTEX ACTION CENTER ═══ */}
                <CortexActionCenter onAssemble={onAssemble} />
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   MODAL (exported for App.jsx)
   ═══════════════════════════════════════════════════════════ */
export function InventoryModal({ isOpen, onClose, onSave, initialData }) {
    const empty = { name: '', bab: '', sub_bab: '', location: '', price: '', stock: '', rarity: 'BIASA' };
    const [form, setForm] = useState(empty);

    // Sync form with modal open/close
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const formData = isOpen ? (initialData ? { ...initialData, price: String(initialData.price), stock: String(initialData.stock), bab: initialData.bab || initialData.category || '', sub_bab: initialData.sub_bab || '', location: initialData.location || '' } : empty) : null;

    // Use effect equivalent inline
    if (isOpen && formData && form._synced !== (initialData?.id || 'new')) {
        setForm({ ...formData, _synced: initialData?.id || 'new' });
    }

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.name || !form.bab) return;
        const { _synced, ...data } = form;

        // Clean price formatting (Indonesian dots are thousands, not decimals)
        // 1. Remove "Rp" and any non-numeric characters EXCEPT dots and commas
        let cleanPrice = String(data.price).replace(/[^0-9.,]/g, '');
        // 2. If it has both dot and comma (e.g. 1.250,50), or just dots (1.250.000)
        // We assume dot is thousands if it appears multiple times or is followed by 3 digits.
        // For simplicity and matching user scenario (123.000), we remove all dots.
        cleanPrice = cleanPrice.replace(/\./g, '');
        // 3. Replace comma with dot for JS Number parsing
        cleanPrice = cleanPrice.replace(/,/g, '.');

        onSave({ ...data, price: Number(cleanPrice) || 0, stock: Number(data.stock) || 0 });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    <motion.div
                        initial={{ scale: 0.85, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }}
                        exit={{ scale: 0.85, opacity: 0, y: 30 }}
                        className="relative w-full max-w-md bg-[#0a0a0c] border border-[var(--color-neon-cyan)]/30 rounded-2xl p-8 shadow-[0_0_60px_rgba(0,243,255,0.15)] overflow-hidden"
                    >
                        {/* CRT overlay */}
                        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 bg-[length:100%_2px,3px_100%] opacity-20 rounded-2xl" />

                        <div className="flex justify-between items-center mb-6 relative z-20">
                            <h2 className="text-2xl font-bold font-mono text-[var(--color-neon-cyan)]">
                                {initialData ? '>> EDIT_PROTOCOL' : '>> NEW_ENTRY'}
                            </h2>
                            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5 relative z-20">
                            <FieldInput label="ITEM_NAME" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Item designation..." />
                            <div className="grid grid-cols-2 gap-4">
                                <FieldInput label="BAB" value={form.bab} onChange={e => setForm({ ...form, bab: e.target.value })} placeholder="Main category..." />
                                <FieldInput label="SUB_BAB" value={form.sub_bab} onChange={e => setForm({ ...form, sub_bab: e.target.value })} placeholder="Sub category..." />
                            </div>
                            <FieldInput label="LOKASI_GUDANG" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Kotak A, Rak B, Laci C..." />
                            <div className="grid grid-cols-2 gap-4">
                                <FieldInput label="UNIT_COST" type="text" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0" />
                                <FieldInput label="STOCK_LEVEL" type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="0" />
                            </div>
                            <div className="relative">
                                <label className="block text-[10px] uppercase font-mono tracking-widest text-[var(--color-neon-cyan)] mb-1 opacity-70">TIPE_REMOTE</label>
                                <select value={form.rarity} onChange={e => setForm({ ...form, rarity: e.target.value })}
                                    className="w-full bg-white/5 border-b border-white/10 p-3 text-white focus:outline-none focus:border-[var(--color-neon-cyan)] transition-all font-mono text-sm rounded-t-sm appearance-none cursor-pointer">
                                    <option value="BIASA"  className="bg-[#0a0a0c]">Remote Biasa</option>
                                    <option value="LANGKA" className="bg-[#0a0a0c]">Remote Langka</option>
                                </select>
                            </div>
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit"
                                className="w-full h-12 bg-gradient-to-r from-[var(--color-neon-cyan)] to-[var(--color-neon-purple)] rounded-lg font-bold text-black flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,243,255,0.4)] hover:shadow-[0_0_30px_rgba(188,19,254,0.6)] transition-shadow relative overflow-hidden group">
                                <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                <Save className="w-5 h-5 relative z-10" /><span className="relative z-10">SAVE_DATA_BLOCK</span>
                            </motion.button>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function FieldInput({ label, type = 'text', value, onChange, placeholder }) {
    return (
        <div className="relative group">
            <label className="block text-[10px] uppercase font-mono tracking-widest text-[var(--color-neon-cyan)] mb-1 opacity-70 group-focus-within:opacity-100 transition-opacity">{label}</label>
            <input type={type} value={value} onChange={onChange} placeholder={placeholder}
                className="w-full bg-white/5 border-b border-white/10 p-3 text-white placeholder-gray-600 focus:outline-none focus:border-[var(--color-neon-cyan)] focus:bg-[var(--color-neon-cyan)]/5 transition-all font-mono text-sm rounded-t-sm" />
            <div className="absolute bottom-0 left-0 w-0 h-[1px] bg-[var(--color-neon-purple)] group-focus-within:w-full transition-all duration-500" />
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   ASSEMBLE MODAL (exported for App.jsx)
   ═══════════════════════════════════════════════════════════ */
export function AssembleModal({ isOpen, onClose, onSave, sourceItem, allItems }) {
    const [targetItemId, setTargetItemId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [materials, setMaterials] = useState([]);

    // Initialize materials with the clicked source item
    useEffect(() => {
        if (isOpen && sourceItem) {
            setMaterials([{ id: sourceItem.id, qty: 1 }]);
            setTargetItemId('');
            setQuantity('');
        }
    }, [isOpen, sourceItem]);

    const handleQuantityChange = (e) => {
        const val = e.target.value;
        setQuantity(val);
        const numVal = Number(val) || 1;
        setMaterials(prev => prev.map(m => ({ ...m, qty: numVal })));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!targetItemId || !quantity || materials.length === 0) return;
        
        // Validate materials
        const hasInvalid = materials.some(m => !m.id || m.qty <= 0);
        if (hasInvalid) return;

        onSave({ targetItemId, quantity: Number(quantity), materials });
    };

    const addMaterial = () => {
        const currentQty = Number(quantity) || 1;
        setMaterials([...materials, { id: '', qty: currentQty }]);
    };

    const removeMaterial = (index) => {
        setMaterials(materials.filter((_, i) => i !== index));
    };

    const updateMaterial = (index, field, value) => {
        const newMaterials = [...materials];
        newMaterials[index][field] = field === 'qty' ? Number(value) : value;
        setMaterials(newMaterials);
    };

    const materialIds = materials.map(m => m.id);
    const validTargets = allItems ? allItems.filter(i => !materialIds.includes(i.id)) : [];
    const availableMaterials = allItems ? allItems.filter(i => i.stock > 0) : [];

    // Check stock errors
    const checkStockError = (mat) => {
        if (!mat.id) return false;
        const item = allItems.find(i => i.id === mat.id);
        return item && mat.qty > item.stock;
    };
    
    const hasAnyStockError = materials.some(checkStockError);

    return (
        <AnimatePresence>
            {isOpen && sourceItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    <motion.div
                        initial={{ scale: 0.85, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }}
                        exit={{ scale: 0.85, opacity: 0, y: 30 }}
                        className="relative w-full max-w-lg bg-[#0a0a0c] border border-[var(--color-neon-purple)]/30 rounded-2xl p-8 shadow-[0_0_60px_rgba(188,19,254,0.15)] overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
                    >
                        <div className="flex justify-between items-center mb-6 relative z-20">
                            <h2 className="text-2xl font-bold font-mono text-[var(--color-neon-purple)]">
                                &gt;&gt; MULTI_ASSEMBLY
                            </h2>
                            <button type="button" onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6 relative z-20">
                            
                            {/* TARGET ITEM */}
                            <div className="p-4 rounded-xl border border-[var(--color-neon-cyan)]/20 bg-[var(--color-neon-cyan)]/5">
                                <h3 className="text-xs font-mono text-[var(--color-neon-cyan)] mb-3 flex items-center gap-2">
                                    <Package className="w-4 h-4" /> 1. HASIL RAKITAN (TARGET)
                                </h3>
                                <div className="space-y-4">
                                    <select 
                                        value={targetItemId} 
                                        onChange={e => setTargetItemId(e.target.value)}
                                        className="w-full bg-[#0a0a0c] border border-white/10 p-3 text-white focus:outline-none focus:border-[var(--color-neon-cyan)] transition-all font-mono text-sm rounded cursor-pointer"
                                        required
                                    >
                                        <option value="" disabled>Pilih Target Remote...</option>
                                        {validTargets.map(target => (
                                            <option key={target.id} value={target.id}>
                                                {target.name} (Stok: {target.stock})
                                            </option>
                                        ))}
                                    </select>
                                    <FieldInput 
                                        label="JUMLAH YANG DIBUAT (TARGET QTY)" 
                                        type="number" 
                                        value={quantity} 
                                        onChange={handleQuantityChange} 
                                        placeholder="Misal: 5" 
                                    />
                                </div>
                            </div>

                            {/* MATERIALS */}
                            <div className="p-4 rounded-xl border border-[var(--color-neon-purple)]/20 bg-[var(--color-neon-purple)]/5">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-xs font-mono text-[var(--color-neon-purple)] flex items-center gap-2">
                                        <Plus className="w-4 h-4" /> 2. BAHAN BAKU (MATERIALS)
                                    </h3>
                                    <button 
                                        type="button" 
                                        onClick={addMaterial}
                                        className="text-[10px] font-mono text-[var(--color-neon-purple)] border border-[var(--color-neon-purple)]/50 px-2 py-1 rounded hover:bg-[var(--color-neon-purple)]/20 transition-colors"
                                    >
                                        + TAMBAH PART
                                    </button>
                                </div>
                                
                                <div className="space-y-3">
                                    {materials.map((mat, index) => {
                                        const stockErr = checkStockError(mat);
                                        return (
                                            <div key={index} className="flex gap-2 items-start">
                                                <div className="flex-1">
                                                    <select 
                                                        value={mat.id} 
                                                        onChange={e => updateMaterial(index, 'id', e.target.value)}
                                                        className={`w-full bg-[#0a0a0c] border ${stockErr ? 'border-red-500/50' : 'border-white/10'} p-2.5 text-white focus:outline-none focus:border-[var(--color-neon-purple)] transition-all font-mono text-xs rounded cursor-pointer`}
                                                        required
                                                    >
                                                        <option value="" disabled>Pilih Part...</option>
                                                        {availableMaterials.map(av => (
                                                            <option key={av.id} value={av.id}>
                                                                {av.name} (Stok: {av.stock})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {stockErr && <p className="text-[10px] text-red-400 mt-1 font-mono">Stok tidak cukup</p>}
                                                </div>
                                                <div className="w-24">
                                                    <input 
                                                        type="number" 
                                                        value={mat.qty} 
                                                        onChange={e => updateMaterial(index, 'qty', e.target.value)}
                                                        className={`w-full bg-[#0a0a0c] border ${stockErr ? 'border-red-500/50' : 'border-white/10'} p-2.5 text-white focus:outline-none focus:border-[var(--color-neon-purple)] transition-all font-mono text-xs rounded`}
                                                        placeholder="Qty"
                                                        min="1"
                                                        required
                                                    />
                                                </div>
                                                {materials.length > 1 && (
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removeMaterial(index)}
                                                        className="p-2.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <motion.button 
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} 
                                type="submit"
                                disabled={!targetItemId || !quantity || hasAnyStockError || materials.some(m => !m.id)}
                                className="w-full h-12 bg-gradient-to-r from-[var(--color-neon-purple)] to-[var(--color-neon-cyan)] rounded-lg font-bold text-black flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(188,19,254,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-shadow relative overflow-hidden"
                            >
                                <Package className="w-5 h-5 relative z-10" />
                                <span className="relative z-10">EKSEKUSI PERAKITAN</span>
                            </motion.button>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
