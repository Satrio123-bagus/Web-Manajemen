import { useState, useEffect, useCallback } from "react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import {
    History,
    Filter,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    Package,
    RefreshCw,
    Trash2,
    Edit3,
    Plus,
    Search,
} from "lucide-react";
import api from "../api";

/* ── Helpers ── */
const TYPE_CONFIG = {
    SALE: {
        label: "Penjualan",
        color: "text-cyan-400",
        bg: "bg-cyan-400/10",
        border: "border-cyan-400/30",
        dot: "bg-cyan-400",
    },
    RESTOCK: {
        label: "Restock",
        color: "text-violet-400",
        bg: "bg-violet-400/10",
        border: "border-violet-400/30",
        dot: "bg-violet-400",
    },
    CREATE: {
        label: "Item Baru",
        color: "text-emerald-400",
        bg: "bg-emerald-400/10",
        border: "border-emerald-400/30",
        dot: "bg-emerald-400",
    },
    UPDATE: {
        label: "Edit",
        color: "text-amber-400",
        bg: "bg-amber-400/10",
        border: "border-amber-400/30",
        dot: "bg-amber-400",
    },
    DELETE: {
        label: "Hapus",
        color: "text-red-400",
        bg: "bg-red-400/10",
        border: "border-red-400/30",
        dot: "bg-red-400",
    },
    ADD: {
        label: "Tambah",
        color: "text-emerald-400",
        bg: "bg-emerald-400/10",
        border: "border-emerald-400/30",
        dot: "bg-emerald-400",
    },
};

const TYPE_ICONS = {
    SALE: <TrendingUp className="w-3.5 h-3.5" />,
    RESTOCK: <RefreshCw className="w-3.5 h-3.5" />,
    CREATE: <Plus className="w-3.5 h-3.5" />,
    ADD: <Plus className="w-3.5 h-3.5" />,
    UPDATE: <Edit3 className="w-3.5 h-3.5" />,
    DELETE: <Trash2 className="w-3.5 h-3.5" />,
};

function getTypeConfig(type) {
    return (
        TYPE_CONFIG[type] || {
            label: type,
            color: "text-gray-400",
            bg: "bg-gray-400/10",
            border: "border-gray-400/30",
            dot: "bg-gray-400",
        }
    );
}

function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}
function formatTime(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}
function formatRp(n) {
    return `Rp ${Number(n || 0).toLocaleString("id-ID")}`;
}

const ALL_TYPES = [
    "ALL",
    "SALE",
    "RESTOCK",
    "CREATE",
    "UPDATE",
    "DELETE",
    "ADD",
];
const PAGE_SIZE = 50;

/* ── Main Component ── */
export default function TransactionHistory() {
    const [allTx, setAllTx] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [serverTotal, setServerTotal] = useState(0);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("ALL");
    const [currentPage, setCurrentPage] = useState(1);

    // Fetch transactions — server-side paging + type filter
    const fetchTx = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const typeParam = typeFilter !== "ALL" ? `&type=${typeFilter}` : "";
            const res = await api.get(
                `/transactions?limit=${PAGE_SIZE}&page=${currentPage}${typeParam}`
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            // Support both {data:[]} and array format
            setAllTx(Array.isArray(json) ? json : json.data || []);
            setServerTotal(json.total || 0);
        } catch {
            setError("Gagal memuat riwayat transaksi.");
        } finally {
            setLoading(false);
        }
    }, [currentPage, typeFilter]);

    useEffect(() => {
        fetchTx();
    }, [fetchTx]);

    // Reset page when type filter changes
    useEffect(() => setCurrentPage(1), [typeFilter]);

    // Client-side text search only (type filtering is now server-side)
    const filtered = searchQuery
        ? allTx.filter((tx) => {
              const q = searchQuery.toLowerCase();
              return (
                  (tx.item_name || "").toLowerCase().includes(q) ||
                  (tx.category || "").toLowerCase().includes(q) ||
                  (tx.transaction_id || "").toLowerCase().includes(q)
              );
          })
        : allTx;

    // Pagination — driven by server total, not filtered length
    const totalPages = Math.max(1, Math.ceil(serverTotal / PAGE_SIZE));
    const paginated = filtered; // Already paginated by server

    // Summary stats (from current page data — approximate for display)
    const salesTotal = allTx
        .filter((t) => t.type === "SALE")
        .reduce((s, t) => s + (t.total || 0), 0);
    const salesCount = allTx.filter((t) => t.type === "SALE").length;
    const restockCount = allTx.filter((t) => t.type === "RESTOCK").length;

    return (
        <div className="min-h-screen bg-[#080c14] text-white font-mono p-4 md:p-6 max-w-[1400px] mx-auto">
            {/* ── HEADER ── */}
            <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 mb-6"
            >
                <div className="p-2.5 rounded-xl bg-[#00f3ff]/10 border border-[#00f3ff]/20">
                    <History className="w-5 h-5 text-[#00f3ff]" />
                </div>
                <div>
                    <h1 className="text-lg font-black tracking-widest text-white uppercase">
                        Transaction_History
                    </h1>
                    <p className="text-[10px] text-gray-600">
                        {allTx.length} total records • {filtered.length}{" "}
                        ditampilkan
                    </p>
                </div>
                <button
                    id="btn-refresh-history"
                    onClick={fetchTx}
                    disabled={loading}
                    className="ml-auto p-2 rounded-lg bg-white/5 hover:bg-[#00f3ff]/10 border border-white/5 hover:border-[#00f3ff]/30 transition-all"
                    title="Refresh"
                >
                    <RefreshCw
                        className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin text-[#00f3ff]" : ""}`}
                    />
                </button>
            </motion.div>

            {/* ── STATS CARDS ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                    {
                        label: "Total Transaksi",
                        value: allTx.length,
                        color: "#00f3ff",
                    },
                    {
                        label: "Total Penjualan",
                        value: salesCount,
                        color: "#bc13fe",
                    },
                    {
                        label: "Total Restock",
                        value: restockCount,
                        color: "#a78bfa",
                    },
                    {
                        label: "Total Revenue",
                        value: formatRp(salesTotal),
                        color: "#34d399",
                        isText: true,
                    },
                ].map((s, i) => (
                    <motion.div
                        key={s.label}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.07 }}
                        className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4"
                    >
                        <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">
                            {s.label}
                        </p>
                        <p
                            className="text-xl font-black"
                            style={{ color: s.color }}
                        >
                            {s.isText ? s.value : s.value.toLocaleString()}
                        </p>
                    </motion.div>
                ))}
            </div>

            {/* ── FILTER BAR ── */}
            <div className="flex flex-col md:flex-row gap-3 mb-5">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                    <input
                        id="input-search-history"
                        type="text"
                        placeholder="Cari nama item, kategori, ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00f3ff]/30 transition-all"
                    />
                </div>

                {/* Type Filter */}
                <div className="flex gap-1.5 flex-wrap">
                    <Filter className="w-3.5 h-3.5 text-gray-600 self-center shrink-0" />
                    {ALL_TYPES.map((t) => {
                        const cfg =
                            t === "ALL"
                                ? {
                                      color: "text-gray-300",
                                      bg: "bg-white/10",
                                      border: "border-white/20",
                                  }
                                : getTypeConfig(t);
                        const active = typeFilter === t;
                        return (
                            <button
                                key={t}
                                id={`btn-filter-${t.toLowerCase()}`}
                                onClick={() => setTypeFilter(t)}
                                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                                    active
                                        ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                                        : "bg-transparent text-gray-600 border-white/5 hover:border-white/15"
                                }`}
                            >
                                {t === "ALL" ? "Semua" : cfg.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── TABLE ── */}
            <div className="bg-white/[0.02] rounded-xl border border-white/[0.05] overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 px-4 py-2.5 border-b border-white/[0.05] text-[9px] uppercase tracking-widest text-gray-600">
                    <span>Tipe</span>
                    <span>Item</span>
                    <span className="hidden md:block text-right">Qty</span>
                    <span className="hidden md:block text-right">Total</span>
                    <span className="text-right">Waktu</span>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-white/[0.03]">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-gray-600 text-xs gap-2">
                            <RefreshCw className="w-4 h-4 animate-spin" />{" "}
                            Memuat data...
                        </div>
                    ) : error ? (
                        <div className="text-center py-16 text-red-400 text-xs">
                            {error}
                        </div>
                    ) : paginated.length === 0 ? (
                        <div className="text-center py-16 text-gray-600 text-xs">
                            Tidak ada transaksi yang cocok.
                        </div>
                    ) : (
                        <AnimatePresence mode="popLayout">
                            {paginated.map((tx, i) => {
                                const cfg = getTypeConfig(tx.type);
                                return (
                                    <motion.div
                                        key={tx.transaction_id || i}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{
                                            delay: i < 10 ? i * 0.02 : 0,
                                        }}
                                        className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 px-4 py-3 hover:bg-white/[0.02] transition-colors items-center"
                                    >
                                        {/* Type Badge */}
                                        <div
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border ${cfg.bg} ${cfg.color} ${cfg.border} shrink-0`}
                                        >
                                            {TYPE_ICONS[tx.type]}
                                            <span className="hidden sm:inline">
                                                {cfg.label}
                                            </span>
                                        </div>

                                        {/* Item Info */}
                                        <div className="min-w-0">
                                            <p className="text-xs text-white font-bold truncate">
                                                {tx.item_name || "—"}
                                            </p>
                                            <p className="text-[9px] text-gray-600 truncate">
                                                {tx.category ||
                                                    tx.transaction_id}
                                            </p>
                                        </div>

                                        {/* Qty */}
                                        <div className="hidden md:block text-right">
                                            <p className="text-xs text-gray-300">
                                                {tx.quantity > 0
                                                    ? `×${tx.quantity}`
                                                    : "—"}
                                            </p>
                                        </div>

                                        {/* Total */}
                                        <div className="hidden md:block text-right">
                                            <p
                                                className={`text-xs font-bold ${tx.type === "SALE" ? "text-cyan-400" : "text-gray-600"}`}
                                            >
                                                {tx.total > 0
                                                    ? formatRp(tx.total)
                                                    : "—"}
                                            </p>
                                        </div>

                                        {/* Timestamp */}
                                        <div className="text-right shrink-0">
                                            <p className="text-[10px] text-gray-400">
                                                {formatDate(tx.timestamp)}
                                            </p>
                                            <p className="text-[9px] text-gray-600">
                                                {formatTime(tx.timestamp)}
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    )}
                </div>
            </div>

            {/* ── PAGINATION ── */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 text-xs text-gray-600">
                    <span>
                        {filtered.length} records • halaman {currentPage}/
                        {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            id="btn-prev-page"
                            onClick={() =>
                                setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-lg border border-white/10 hover:border-[#00f3ff]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            id="btn-next-page"
                            onClick={() =>
                                setCurrentPage((p) =>
                                    Math.min(totalPages, p + 1)
                                )
                            }
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-lg border border-white/10 hover:border-[#00f3ff]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
