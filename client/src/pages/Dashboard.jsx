import { useMemo, useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
    Coins, Package, AlertTriangle, TrendingUp, Trash2,
    Edit3, Plus, X, Save, Search, ChevronDown, DollarSign
} from 'lucide-react';
import ActivityLog from '../components/ActivityLog';

/* ═══════════════════════════════════════════════════════════
   RARITY CONFIG
   ═══════════════════════════════════════════════════════════ */
const RARITY_STYLE = {
    COMMON: { text: 'text-gray-400', border: 'border-gray-500/40', bg: 'bg-gray-500/10', dot: 'bg-gray-400' },
    RARE: { text: 'text-[var(--color-neon-cyan)]', border: 'border-[var(--color-neon-cyan)]/40', bg: 'bg-[var(--color-neon-cyan)]/10', dot: 'bg-[var(--color-neon-cyan)]' },
    LEGENDARY: { text: 'text-amber-400', border: 'border-amber-400/40', bg: 'bg-amber-400/10', dot: 'bg-amber-400' },
};

function stockStatus(stock) {
    if (stock <= 0) return { label: 'OUT_OF_STOCK', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-500' };
    if (stock < 5) return { label: 'LOW_STOCK', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', dot: 'bg-amber-400' };
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
export default function Dashboard({ items, meta, onPageChange, onDelete, onEdit, onAdd, onSell, isDeleting, onSearch }) {
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
        const lowStock = items.filter(i => i.stock < 5).length;
        return { totalAssets, totalItems, lowStock };
    }, [items]);

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
                    icon={Package} label="System Load" value={stats.totalItems} suffix="ITEMS"
                    accent="from-[var(--color-neon-purple)] to-pink-500" delay={0.1}
                />
                <StatCard
                    icon={AlertTriangle} label="Critical Alerts" value={stats.lowStock} suffix="LOW"
                    accent="from-amber-400 to-red-500" delay={0.2}
                />
            </div>

            {/* ═══ MAIN CONTENT GRID ═══ */}
            <div className="space-y-8">
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
                                            const rarity = RARITY_STYLE[item.rarity] || RARITY_STYLE.COMMON;
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
                                                        <span className="font-bold text-white group-hover/row:text-[var(--color-neon-cyan)] transition-colors">
                                                            {item.name}
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

                                                    {/* RARITY */}
                                                    <td className="px-5 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest uppercase border ${rarity.text} ${rarity.bg} ${rarity.border}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${rarity.dot}`} />
                                                            {item.rarity || 'COMMON'}
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
                                                            <span className={`font-mono font-bold tabular-nums ${item.stock < 5 ? 'text-amber-400' : 'text-white'}`}>
                                                                {item.stock}
                                                            </span>
                                                            {/* Mini bar */}
                                                            <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-500 ${item.stock < 5 ? 'bg-amber-400' : 'bg-[var(--color-neon-cyan)]'}`}
                                                                    style={{ width: `${Math.min(100, (item.stock / 50) * 100)}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* STATUS */}
                                                    <td className="px-5 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-mono tracking-widest border ${status.color} ${status.bg} ${status.border}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${item.stock < 5 ? 'animate-pulse' : ''}`} />
                                                            {status.label}
                                                        </span>
                                                    </td>

                                                    {/* ACTIONS */}
                                                    <td className="px-5 py-4">
                                                        <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                            {/* Quick Sell */}
                                                            <motion.button
                                                                whileHover={item.stock > 0 ? { scale: 1.1 } : {}} whileTap={item.stock > 0 ? { scale: 0.9 } : {}}
                                                                onClick={() => item.stock > 0 && onSell(item.id)}
                                                                disabled={item.stock <= 0}
                                                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-all border ${item.stock > 0
                                                                    ? 'text-amber-400 border-amber-400/30 hover:bg-amber-400/10 hover:border-amber-400/60 hover:shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                                                                    : 'text-gray-600 border-gray-700/30 bg-gray-800/30 cursor-not-allowed'
                                                                    }`}
                                                                title={item.stock > 0 ? `Sell 1x ${item.name}` : 'Out of stock'}
                                                            >
                                                                <DollarSign className="w-3 h-3" />
                                                                {item.stock > 0 ? 'SELL' : 'EMPTY'}
                                                            </motion.button>
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
                            <p className="text-[10px] font-mono text-gray-600">
                                TOTAL_ASSETS: <span className="text-[var(--color-neon-cyan)]">{stats.totalAssets.toLocaleString()} Rp</span>
                            </p>
                            
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

                {/* ═══ ACTIVITY LOG ═══ */}
                <ActivityLog />
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   MODAL (exported for App.jsx)
   ═══════════════════════════════════════════════════════════ */
export function InventoryModal({ isOpen, onClose, onSave, initialData }) {
    const empty = { name: '', bab: '', sub_bab: '', price: '', stock: '', rarity: 'COMMON' };
    const [form, setForm] = useState(empty);

    // Sync form with modal open/close
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const formData = isOpen ? (initialData ? { ...initialData, price: String(initialData.price), stock: String(initialData.stock), bab: initialData.bab || initialData.category || '', sub_bab: initialData.sub_bab || '' } : empty) : null;

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
                            <div className="grid grid-cols-2 gap-4">
                                <FieldInput label="UNIT_COST" type="text" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0" />
                                <FieldInput label="STOCK_LEVEL" type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="0" />
                            </div>
                            <div className="relative">
                                <label className="block text-[10px] uppercase font-mono tracking-widest text-[var(--color-neon-cyan)] mb-1 opacity-70">RARITY_CLASS</label>
                                <select value={form.rarity} onChange={e => setForm({ ...form, rarity: e.target.value })}
                                    className="w-full bg-white/5 border-b border-white/10 p-3 text-white focus:outline-none focus:border-[var(--color-neon-cyan)] transition-all font-mono text-sm rounded-t-sm appearance-none cursor-pointer">
                                    <option value="COMMON" className="bg-[#0a0a0c]">COMMON</option>
                                    <option value="RARE" className="bg-[#0a0a0c]">RARE</option>
                                    <option value="LEGENDARY" className="bg-[#0a0a0c]">LEGENDARY</option>
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
