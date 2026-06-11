import { useState, useEffect } from "react";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import {
    BrainCircuit,
    AlertTriangle,
    Package,
    ShoppingCart,
} from "lucide-react";
import api from "../api";

export default function CortexActionCenter({ onAssemble }) {
    const [actionItems, setActionItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const res = await api.get("/analytics");
                if (res.ok) {
                    const data = await res.json();
                    // We only care about items that need immediate attention
                    if (data.lowStockItems) {
                        setActionItems(data.lowStockItems);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch action center data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
        const intervalId = setInterval(fetchAnalytics, 10000); // Poll every 10 seconds

        return () => clearInterval(intervalId);
    }, []);

    const renderActionItem = (item) => {
        const isOutOfStock = item.stock <= 0;
        const isAssemblable =
            item.bab === "WIP" ||
            item.category === "WIP" ||
            item.bab === "SPARE_PART" ||
            item.category === "SPARE_PART" ||
            item.name.toLowerCase().includes("casing") ||
            item.name.toLowerCase().includes("bahan");

        return (
            <div
                key={item.id}
                className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-xl transition-colors group"
            >
                <div className="flex items-start gap-3 mb-3 sm:mb-0">
                    <div
                        className={`p-2 rounded-lg ${isOutOfStock ? "bg-red-500/10 text-red-500" : "bg-amber-400/10 text-amber-400"}`}
                    >
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white text-sm group-hover:text-[var(--color-neon-purple)] transition-colors">
                            {item.name}
                        </h4>
                        <p className="font-mono text-[10px] text-gray-500 mt-1">
                            {isOutOfStock ? (
                                <span className="text-red-400">
                                    OUT OF STOCK (0 Unit)
                                </span>
                            ) : (
                                <span className="text-amber-400">
                                    CRITICAL STOCK ({item.stock} Unit)
                                </span>
                            )}
                            {" | "}
                            <span className="uppercase tracking-widest">
                                {item.bab || item.category}
                            </span>
                        </p>
                    </div>
                </div>

                <div>
                    {isAssemblable ? (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onAssemble(item)}
                            className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-mono font-bold flex justify-center items-center gap-2 transition-all border text-[var(--color-neon-cyan)] border-[var(--color-neon-cyan)]/30 bg-[var(--color-neon-cyan)]/10 hover:shadow-[0_0_15px_rgba(0,243,255,0.3)]"
                        >
                            <Package className="w-4 h-4" />
                            EKSEKUSI RAKIT
                        </motion.button>
                    ) : (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-mono font-bold flex justify-center items-center gap-2 transition-all border text-[var(--color-neon-purple)] border-[var(--color-neon-purple)]/30 bg-[var(--color-neon-purple)]/10 hover:shadow-[0_0_15px_rgba(188,19,254,0.3)]"
                            onClick={() =>
                                window.alert(
                                    "Catatan belanja berhasil disalin. Silakan pesan ke supplier."
                                )
                            }
                        >
                            <ShoppingCart className="w-4 h-4" />
                            BELI KE SUPPLIER
                        </motion.button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="h-full"
        >
            <div className="h-full flex flex-col rounded-2xl border border-[var(--color-neon-purple)]/30 bg-[rgba(8,8,12,0.8)] backdrop-blur-xl overflow-hidden shadow-[0_0_30px_rgba(188,19,254,0.1)] relative">
                {/* Glow Background */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-[var(--color-neon-purple)] opacity-20 blur-[100px] pointer-events-none" />

                {/* Header */}
                <div className="px-5 py-4 border-b border-white/5 relative z-10">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-[var(--color-neon-purple)]" />
                        Cortex Action Center
                    </h3>
                    <p className="text-xs font-mono text-gray-500 mt-1">
                        AI-Powered priority tasks & restock queue
                    </p>
                </div>

                {/* List Container */}
                <div className="flex-1 p-5 space-y-3 overflow-y-auto relative z-10 max-h-[400px]">
                    {loading ? (
                        <div className="py-8 text-center font-mono text-gray-600">
                            <span className="w-4 h-4 rounded-full bg-[var(--color-neon-purple)] animate-ping inline-block mb-3" />
                            <p>Menganalisis Kebutuhan Gudang...</p>
                        </div>
                    ) : actionItems.length > 0 ? (
                        actionItems.map(renderActionItem)
                    ) : (
                        <div className="py-12 text-center font-mono text-gray-500">
                            <BrainCircuit className="w-12 h-12 mx-auto text-emerald-500/50 mb-3" />
                            <p className="text-sm font-bold text-emerald-400">
                                STATUS AMAN (OPTIMAL)
                            </p>
                            <p className="text-xs mt-1">
                                Tidak ada aksi darurat yang diperlukan saat ini.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
