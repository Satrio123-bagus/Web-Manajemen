import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench, ArrowRight, AlertTriangle } from "lucide-react";
import api from "../api";
import { useSound } from "../hooks/useSound";

export default function AdminMikaStation() {
    const [wipItems, setWipItems] = useState([]);
    const [mikaStocks, setMikaStocks] = useState([]);
    const [recipes, setRecipes] = useState([]);
    const [selectedWip, setSelectedWip] = useState("");
    const [assemblyQty, setAssemblyQty] = useState(1);

    // Defect states
    const [defectQty, setDefectQty] = useState(1);

    const [toast, setToast] = useState(null);
    const { playSound } = useSound();

    const fetchData = async () => {
        try {
            const res = await api.get("/assembly/wip");
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setWipItems(data.wip || []);
                    setMikaStocks(data.mikaStocks || []);
                    setRecipes(data.recipes || []);
                    if (data.wip?.length > 0 && !selectedWip) {
                        setSelectedWip(data.wip[0].id);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to fetch WIP data", err);
        }
    };

    useEffect(() => {
        fetchData();
        const intervalId = setInterval(fetchData, 10000);
        return () => clearInterval(intervalId);
    }, []);

    const selectedWipItem = wipItems.find((w) => w.id === selectedWip);
    const wipBaseName = selectedWipItem
        ? selectedWipItem.name.replace(" (Tanpa Mika)", "").trim()
        : "";
    const recipe = recipes.find((r) => r.tipe_remote === wipBaseName);
    // Jika tidak ada resep, kembalikan ke Mika Default
    const targetMikaName = recipe?.jenis_mika || "Mika Default";
    const requiredMikaStock = mikaStocks.find(
        (m) => m.name === targetMikaName
    ) || { id: null, name: targetMikaName, stock: 0 };

    const handleAssemble = async () => {
        if (!selectedWip || assemblyQty <= 0) return;
        if (!requiredMikaStock.id) {
            playSound("error");
            setToast({
                type: "error",
                msg: `Komponen ${targetMikaName} belum terdaftar di sistem. Harap tambahkan dulu di Inventory.`,
            });
            return;
        }
        try {
            const res = await api.post("/assembly/assemble", {
                wip_id: selectedWip,
                mika_id: requiredMikaStock.id,
                quantity: assemblyQty,
            });
            const data = await res.json();
            if (res.ok && data.success) {
                playSound("success");
                setToast({
                    type: "success",
                    msg: `Berhasil merakit ${data.quantity} ${data.hasil}`,
                });
                setAssemblyQty(1);
                fetchData();
            } else {
                playSound("error");
                setToast({ type: "error", msg: data.error || "Gagal merakit" });
            }
        } catch (err) {
            playSound("error");
            setToast({ type: "error", msg: "Terjadi kesalahan sistem" });
        }
        setTimeout(() => setToast(null), 3000);
    };

    const handleDefect = async () => {
        if (defectQty <= 0) return;
        if (!requiredMikaStock.id) {
            playSound("error");
            setToast({
                type: "error",
                msg: `Komponen ${targetMikaName} belum terdaftar di sistem.`,
            });
            return;
        }
        try {
            const res = await api.post("/assembly/defect-mika", {
                mika_id: requiredMikaStock.id,
                quantity: defectQty,
            });
            const data = await res.json();
            if (res.ok && data.success) {
                playSound("success");
                setToast({
                    type: "success",
                    msg: `Berhasil melapor ${defectQty} mika kusam`,
                });
                setDefectQty(1);
                fetchData();
            } else {
                playSound("error");
                setToast({ type: "error", msg: data.error || "Gagal melapor" });
            }
        } catch (err) {
            playSound("error");
            setToast({ type: "error", msg: "Terjadi kesalahan sistem" });
        }
        setTimeout(() => setToast(null), 3000);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-8 rounded-2xl border border-[var(--color-neon-cyan)]/30 bg-[rgba(8,8,12,0.8)] backdrop-blur-xl overflow-hidden shadow-[0_0_30px_rgba(0,243,255,0.05)] relative"
        >
            <div className="px-5 py-4 border-b border-white/5 relative z-10 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-[var(--color-neon-cyan)]" />
                    Stasiun Rakit Mika
                </h3>
                <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
                    <span className="text-[10px] font-mono text-gray-400">
                        STOK {requiredMikaStock.name.toUpperCase()}:
                    </span>
                    <span
                        className={`text-sm font-bold ${requiredMikaStock.stock > 0 ? "text-emerald-400" : "text-red-400"}`}
                    >
                        {requiredMikaStock.stock} PCS
                    </span>
                </div>
            </div>

            <div className="p-5 relative z-10 space-y-4">
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="text-[10px] font-mono text-gray-500 uppercase mb-1 block">
                            Pilih Barang (Tanpa Mika)
                        </label>
                        <select
                            value={selectedWip}
                            onChange={(e) => setSelectedWip(e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[var(--color-neon-cyan)]/50"
                        >
                            {wipItems.length === 0 ? (
                                <option value="">
                                    -- Tidak ada barang WIP --
                                </option>
                            ) : (
                                wipItems.map((wip) => (
                                    <option key={wip.id} value={wip.id}>
                                        {wip.name} (Stok: {wip.stock})
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-32">
                            <label className="text-[10px] font-mono text-gray-500 uppercase mb-1 block">
                                Qty Rakit
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={assemblyQty}
                                onChange={(e) =>
                                    setAssemblyQty(Number(e.target.value))
                                }
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white text-center"
                            />
                        </div>
                        <div className="flex-1 flex items-end">
                            <button
                                onClick={handleAssemble}
                                disabled={
                                    !selectedWip ||
                                    assemblyQty <= 0 ||
                                    requiredMikaStock.stock < assemblyQty
                                }
                                className="w-full h-[46px] px-6 rounded-xl bg-[var(--color-neon-cyan)]/20 text-[var(--color-neon-cyan)] border border-[var(--color-neon-cyan)]/40 font-bold text-sm hover:bg-[var(--color-neon-cyan)] hover:text-black transition-all disabled:opacity-30 flex justify-center items-center gap-2"
                            >
                                RAKIT & PASANG MIKA
                            </button>
                        </div>
                    </div>
                </div>

                <div className="border-t border-white/10 my-2"></div>

                {/* Defect Reporter */}
                <div className="flex gap-4 items-end bg-red-500/5 p-4 rounded-xl border border-red-500/10">
                    <div className="flex-1">
                        <label className="text-[10px] font-mono text-red-400 uppercase mb-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Lapor Mika
                            Kusam/Rusak
                        </label>
                        <p className="text-[10px] text-gray-500">
                            Mika akan dipisah untuk dipoles ulang oleh pekerja.
                        </p>
                    </div>
                    <div className="w-24">
                        <input
                            type="number"
                            min="1"
                            value={defectQty}
                            onChange={(e) =>
                                setDefectQty(Number(e.target.value))
                            }
                            className="w-full bg-black/50 border border-red-500/30 rounded-xl px-4 py-2 text-sm text-red-400 text-center"
                        />
                    </div>
                    <button
                        onClick={handleDefect}
                        disabled={
                            defectQty <= 0 ||
                            requiredMikaStock.stock < defectQty
                        }
                        className="h-[38px] px-4 rounded-xl bg-red-500/20 text-red-400 border border-red-500/40 text-xs font-bold hover:bg-red-500 hover:text-white transition-all disabled:opacity-30"
                    >
                        LAPOR RUSAK
                    </button>
                </div>

                <AnimatePresence>
                    {toast && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className={`mt-4 p-3 rounded-xl text-xs font-mono text-center border ${
                                toast.type === "success"
                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                    : "bg-red-500/10 border-red-500/30 text-red-400"
                            }`}
                        >
                            {toast.msg}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
