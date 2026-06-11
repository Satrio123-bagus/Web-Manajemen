import { useState, useEffect } from "react";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import { Zap, CheckCircle2, Activity } from "lucide-react";
import api from "../api";

function GlassCard({ children, className = "", delay = 0 }) {
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

function GlitchHeader({ children, className = "" }) {
    return (
        <div className={`relative group inline-block ${className}`}>
            <span className="relative z-10">{children}</span>
            <span
                className="absolute inset-0 text-[var(--color-neon-cyan)] opacity-0 group-hover:opacity-70 group-hover:animate-[glitch_0.3s_infinite] select-none pointer-events-none mix-blend-screen"
                aria-hidden
            >
                {children}
            </span>
            <span
                className="absolute inset-0 text-[var(--color-neon-purple)] opacity-0 group-hover:opacity-70 group-hover:animate-[glitch_0.3s_infinite_reverse_0.05s] select-none pointer-events-none mix-blend-multiply"
                aria-hidden
            >
                {children}
            </span>
        </div>
    );
}

export default function OrderFulfillment() {
    const [orders, setOrders] = useState([]);
    const [isCompletingOrder, setIsCompletingOrder] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const res = await api.get("/orders/pending");
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) setOrders(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrders();
        const intervalId = setInterval(fetchOrders, 30000);
        return () => clearInterval(intervalId);
    }, []);

    const handleCreateOrder = async (e) => {
        e.preventDefault();
        const tipe_remote = e.target.tipe_remote.value.trim();
        const quantity = parseInt(e.target.quantity.value);
        if (!tipe_remote || quantity < 1) return;

        try {
            const res = await api.post("/orders", { tipe_remote, quantity });
            if (res.ok) {
                e.target.reset();
                const ordersData = await api
                    .get("/orders/pending")
                    .then((r) => r.json());
                if (Array.isArray(ordersData)) setOrders(ordersData);
            }
        } catch (err) {
            console.error("Gagal membuat pesanan", err);
        }
    };

    const handleCompleteOrder = async (id) => {
        setIsCompletingOrder(id);
        try {
            const res = await api.put(`/orders/${id}/complete`);
            if (!res.ok) {
                const errData = await res.json();
                alert("Gagal menyelesaikan pesanan: " + errData.error);
            } else {
                const ordersData = await api
                    .get("/orders/pending")
                    .then((r) => r.json());
                if (Array.isArray(ordersData)) setOrders(ordersData);
            }
        } catch (err) {
            console.error("Gagal menyelesaikan pesanan", err);
        } finally {
            setIsCompletingOrder(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh] font-mono text-[var(--color-neon-purple)]">
                <Activity className="w-6 h-6 animate-spin mr-3" />{" "}
                LOADING_ORDERS...
            </div>
        );
    }

    return (
        <div className="relative max-w-[1400px] mx-auto space-y-6">
            {/* Scanline Overlay */}
            <div className="fixed inset-0 pointer-events-none z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[length:100%_2px] opacity-[0.15]" />

            <header>
                <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-neon-purple)] to-pink-500 uppercase">
                    ORDER CENTER
                </h1>
                <p className="text-gray-400 font-mono text-sm mt-1 uppercase">
                    Pusat pembuatan dan manajemen antrean pesanan mendesak
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard
                    delay={0.1}
                    className="border-t-4 border-t-[var(--color-neon-purple)] flex flex-col"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Zap className="w-5 h-5 text-[var(--color-neon-purple)]" />
                        <GlitchHeader className="text-sm font-mono tracking-[0.2em] text-[var(--color-neon-purple)] uppercase font-bold">
                            BUAT_PESANAN_BARU
                        </GlitchHeader>
                    </div>

                    <p className="text-xs font-mono text-gray-400 mb-6">
                        Pesanan yang dibuat disini akan langsung muncul sebagai
                        notifikasi PRIORITAS berkedip di layar para pekerja
                        (Casing & Mesin). Gunakan hanya untuk pesanan mendesak.
                    </p>

                    <form
                        onSubmit={handleCreateOrder}
                        className="flex flex-col gap-4 mt-auto"
                    >
                        <div>
                            <label className="block text-[10px] font-mono text-gray-500 mb-1">
                                TIPE REMOTE / BARANG
                            </label>
                            <input
                                type="text"
                                name="tipe_remote"
                                placeholder="Contoh: A75C3865"
                                required
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-[var(--color-neon-cyan)] focus:border-[var(--color-neon-purple)] outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-mono text-gray-500 mb-1">
                                KUANTITAS DIBUTUHKAN
                            </label>
                            <input
                                type="number"
                                name="quantity"
                                placeholder="Qty"
                                defaultValue="1"
                                min="1"
                                required
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white focus:border-[var(--color-neon-purple)] outline-none transition-colors"
                            />
                        </div>
                        <button
                            type="submit"
                            className="mt-2 w-full bg-[var(--color-neon-purple)]/20 hover:bg-[var(--color-neon-purple)]/40 text-[var(--color-neon-purple)] border border-[var(--color-neon-purple)]/50 px-4 py-4 rounded-xl font-bold text-sm uppercase transition-colors"
                        >
                            + TAMBAH KE ANTREAN PEKERJA
                        </button>
                    </form>
                </GlassCard>

                <GlassCard
                    delay={0.2}
                    className="border-t-4 border-t-[var(--color-neon-cyan)] flex flex-col"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-[var(--color-neon-cyan)]" />
                            <GlitchHeader className="text-sm font-mono tracking-[0.2em] text-[var(--color-neon-cyan)] uppercase font-bold">
                                ANTREAN_PESANAN_AKTIF
                            </GlitchHeader>
                        </div>
                        <span className="text-[10px] font-mono bg-[var(--color-neon-cyan)]/20 text-[var(--color-neon-cyan)] px-2 py-1 rounded">
                            {orders.length} AKTIF
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar min-h-[300px]">
                        {orders.length === 0 ? (
                            <div className="text-center text-gray-500 font-mono text-xs py-12 opacity-50 flex flex-col items-center">
                                <Zap className="w-12 h-12 mb-3 text-gray-700" />
                                SEMUA PESANAN TELAH DISELESAIKAN
                            </div>
                        ) : (
                            orders.map((order) => (
                                <div
                                    key={order.id}
                                    className="bg-[var(--color-neon-purple)]/5 border border-[var(--color-neon-purple)]/20 rounded-xl p-4 flex justify-between items-center group transition-colors hover:bg-[var(--color-neon-purple)]/10 hover:border-[var(--color-neon-purple)]/40"
                                >
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="text-lg font-black text-white">
                                                {order.tipe_remote}
                                            </span>
                                            <span className="text-xs font-mono bg-[var(--color-neon-purple)]/20 text-[var(--color-neon-purple)] px-2 py-0.5 rounded font-bold">
                                                Qty: {order.quantity}
                                            </span>
                                        </div>
                                        <p className="text-[10px] font-mono text-gray-500">
                                            Waktu diminta:{" "}
                                            {new Date(
                                                order.timestamp
                                            ).toLocaleTimeString("id-ID")}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() =>
                                            handleCompleteOrder(order.id)
                                        }
                                        disabled={
                                            isCompletingOrder === order.id
                                        }
                                        className={`bg-[var(--color-neon-cyan)]/10 hover:bg-[var(--color-neon-cyan)]/20 text-[var(--color-neon-cyan)] border border-[var(--color-neon-cyan)]/30 p-3 rounded-xl transition-all flex items-center gap-2 font-bold text-xs ${isCompletingOrder === order.id ? "opacity-50 cursor-not-allowed" : ""}`}
                                        title="Selesaikan & Potong Stok"
                                    >
                                        <CheckCircle2
                                            className={`w-5 h-5 ${isCompletingOrder === order.id ? "animate-spin" : ""}`}
                                        />
                                        {isCompletingOrder === order.id
                                            ? "MEMPROSES..."
                                            : "SELESAI (POTONG STOK)"}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
}
