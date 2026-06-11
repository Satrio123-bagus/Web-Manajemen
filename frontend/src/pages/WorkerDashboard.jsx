import { useState, useEffect } from "react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
    CheckCircle,
    AlertTriangle,
    Send,
    Activity,
    Target,
    MessageSquare,
    Briefcase,
    Zap,
    Check,
    Wrench,
    ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import api from "../api";
import { useSound } from "../hooks/useSound";

const NEON_CYAN = "#00f3ff";
const NEON_PURPLE = "#bc13fe";
const EMERALD = "#10b981";
const RED = "#ef4444";

function GlassCard({ children, className = "", delay = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, delay }}
            className={`relative bg-white/[0.04] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 overflow-hidden group ${className}`}
        >
            {children}
        </motion.div>
    );
}

export default function WorkerDashboard({ user }) {
    const [jobs, setJobs] = useState([]);
    const [reports, setReports] = useState([]);
    const [reportText, setReportText] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [adminMessage, setAdminMessage] = useState("");
    const [orders, setOrders] = useState([]);
    const { playSound } = useSound();

    // Mesin State
    const MESIN_REWORK_TAGS = [
        "Ganti Per",
        "Solder LED",
        "Jalur Putus",
        "Tombol Karbon",
        "Komponen Korosi",
    ];
    const [mesinToast, setMesinToast] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [resJobs, resSupplies, resConfig, resOrders] =
                    await Promise.all([
                        api.get("/production/jobs"),
                        api.get("/production/supplies"),
                        api.get("/settings/config"),
                        api.get("/orders/pending"),
                    ]);

                if (resJobs.ok) {
                    const data = await resJobs.json();
                    setJobs(data.jobs);
                }
                if (resSupplies.ok) {
                    const data = await resSupplies.json();
                    setReports(data.reports);
                }
                if (resConfig.ok) {
                    const data = await resConfig.json();
                    setAdminMessage(data.adminMessage || "");
                }
                if (resOrders.ok) {
                    const data = await resOrders.json();
                    if (Array.isArray(data)) setOrders(data);
                }
            } catch (error) {
                console.error("Fetch error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const sendReport = async () => {
        if (!reportText.trim()) return;
        try {
            playSound("click");
            const res = await api.post("/production/supplies", {
                pekerja: user.username,
                laporan: reportText,
            });
            if (res.ok) {
                setReportText("");
                // Fetch reports again
                const repRes = await api.get("/production/supplies");
                if (repRes.ok) {
                    const data = await repRes.json();
                    setReports(data.reports);
                }
            }
        } catch {
            console.error(err);
        }
    };

    const handleMesinRework = async (tag) => {
        try {
            playSound("click");
            const res = await api.post("/production/supplies", {
                pekerja: user.username,
                laporan: `[SERVIS MESIN] Tindakan: ${tag} (+1 unit)`,
            });
            if (res.ok) {
                setMesinToast({
                    type: "success",
                    msg: `Berhasil mencatat servis: ${tag}`,
                });
                const repRes = await api.get("/production/supplies");
                if (repRes.ok) {
                    const data = await repRes.json();
                    setReports(data.reports);
                }
            }
        } catch {
            setMesinToast({ type: "error", msg: "Gagal mencatat servis" });
        }
        setTimeout(() => setMesinToast(null), 3000);
    };

    // Filter data based on role
    const myJobs = jobs.filter((job) => {
        if (user?.role === "CASING")
            return ["CASING", "MIKA", "TUTUP BATERAI"].includes(job.komponen);
        if (user?.role === "MESIN")
            return job.komponen === "MESIN" || job.komponen === "LAYAR";
        return true;
    });

    const myReports = reports.filter((r) => r.pekerja === user?.username);

    // Calculate Quality Yield
    const totalBagus = myJobs
        .filter((j) =>
            ["QC_CEK", "SELESAI_JUAL", "SELESAI_RAKIT"].includes(j.status)
        )
        .reduce((acc, j) => acc + j.alokasi, 0);
    const totalRusak = myJobs
        .filter((j) => j.status === "RUSAK")
        .reduce((acc, j) => acc + j.alokasi, 0);
    const totalProcessed = totalBagus + totalRusak;
    const yieldRate =
        totalProcessed > 0
            ? Math.round((totalBagus / totalProcessed) * 100)
            : 0;

    const chartData = [
        { name: "Berhasil Diselamatkan", value: totalBagus, color: EMERALD },
        { name: "Rusak/Gagal", value: totalRusak, color: RED },
    ];

    // Calculate Queue
    const waitingJobsCount = myJobs
        .filter((j) => j.status === "MENTAH")
        .reduce((acc, j) => acc + j.alokasi, 0);
    const inProgressCount = myJobs
        .filter((j) => j.status === "PROSES")
        .reduce((acc, j) => acc + j.alokasi, 0);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh] font-mono text-[var(--color-neon-cyan)]">
                <Activity className="w-6 h-6 animate-spin mr-3" />{" "}
                MEMUAT_DASHBOARD...
            </div>
        );
    }

    return (
        <div className="relative max-w-[1400px] mx-auto space-y-6">
            <header>
                <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-neon-cyan)] to-blue-500 uppercase">
                    WORKER HUB
                </h1>
                <p className="text-gray-400 font-mono text-sm mt-1 uppercase">
                    Selamat bekerja, {user?.username} ({user?.role})
                </p>
            </header>

            {orders.length > 0 && (
                <GlassCard
                    delay={0.05}
                    className="border-2 border-[var(--color-neon-purple)] animate-[pulse_2s_ease-in-out_infinite] shadow-[0_0_20px_rgba(188,19,254,0.3)]"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-5 h-5 text-[var(--color-neon-purple)]" />
                        <h2 className="text-lg font-black tracking-widest text-[var(--color-neon-purple)] uppercase">
                            PRIORITAS PESANAN HARI INI
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {orders.map((order) => (
                            <div
                                key={order.id}
                                className="bg-[var(--color-neon-purple)]/10 border border-[var(--color-neon-purple)]/30 rounded-xl p-4 flex flex-col items-center justify-center text-center"
                            >
                                <span className="text-2xl font-black text-white">
                                    {order.tipe_remote}
                                </span>
                                <span className="text-sm font-bold text-[var(--color-neon-purple)] mt-1">
                                    DIBUTUHKAN: {order.quantity} PCS
                                </span>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* WIDGET 1: QUALITY YIELD (OR TRIAGE STATS FOR MESIN) */}
                <GlassCard
                    delay={0.1}
                    className="xl:col-span-1 border-t-4 border-t-emerald-500"
                >
                    <div className="flex items-center gap-2 mb-6">
                        <Target className="w-5 h-5 text-emerald-400" />
                        <h2 className="text-sm font-black tracking-widest text-white uppercase">
                            {user?.role === "MESIN"
                                ? "Statistik Triage Mesin"
                                : "Skor Kualitas Anda"}
                        </h2>
                    </div>

                    <div className="relative h-48 flex items-center justify-center mb-4">
                        {totalProcessed === 0 ? (
                            <div className="text-gray-500 font-mono text-xs text-center border border-dashed border-gray-600 rounded-full w-40 h-40 flex items-center justify-center p-4">
                                BELUM ADA DATA HARI INI
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.color}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "rgba(0,0,0,0.8)",
                                            borderColor: "#333",
                                            borderRadius: "8px",
                                        }}
                                        itemStyle={{
                                            color: "#fff",
                                            fontSize: "12px",
                                            fontWeight: "bold",
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                        {totalProcessed > 0 && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-3xl font-black text-white">
                                    {yieldRate}%
                                </span>
                                <span className="text-[10px] font-mono text-gray-400 uppercase">
                                    YIELD RATE
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-between items-center text-xs font-mono bg-black/40 p-3 rounded-lg border border-white/5">
                        <div className="text-emerald-400 font-bold">
                            {totalBagus} Diselamatkan
                        </div>
                        <div className="text-red-400 font-bold">
                            {totalRusak} Gagal
                        </div>
                    </div>
                </GlassCard>

                {/* WIDGET 2: BRIEFING & ANTREAN */}
                <div className="xl:col-span-1 space-y-6">
                    <GlassCard
                        delay={0.2}
                        className="border-t-4 border-t-[var(--color-neon-cyan)]"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Briefcase className="w-5 h-5 text-[var(--color-neon-cyan)]" />
                            <h2 className="text-sm font-black tracking-widest text-white uppercase">
                                Status Antrean
                            </h2>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-4 text-center">
                                <div className="text-3xl font-black text-gray-300 mb-1">
                                    {waitingJobsCount}
                                </div>
                                <div className="text-[10px] font-mono text-gray-400 uppercase">
                                    Menunggu (Mentah)
                                </div>
                            </div>
                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2">
                                    {inProgressCount > 0 && (
                                        <span className="flex w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                    )}
                                </div>
                                <div className="text-3xl font-black text-amber-400 mb-1">
                                    {inProgressCount}
                                </div>
                                <div className="text-[10px] font-mono text-amber-500/70 uppercase">
                                    Sedang Dikerjakan
                                </div>
                            </div>
                        </div>

                        <Link
                            to="/production"
                            className="mt-4 w-full flex items-center justify-center gap-2 bg-[var(--color-neon-cyan)]/10 hover:bg-[var(--color-neon-cyan)]/20 text-[var(--color-neon-cyan)] font-bold py-3 rounded-xl border border-[var(--color-neon-cyan)]/30 transition-all"
                        >
                            <Zap className="w-4 h-4" /> BUKA PAPAN KERJA
                        </Link>
                    </GlassCard>

                    <GlassCard
                        delay={0.3}
                        className="bg-blue-500/5 border-blue-500/20"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="w-4 h-4 text-blue-400" />
                            <h2 className="text-[10px] font-bold tracking-widest text-blue-400 uppercase">
                                Pesan Admin Hari Ini
                            </h2>
                        </div>
                        <p className="text-sm font-medium text-blue-100 italic whitespace-pre-wrap">
                            {adminMessage ? (
                                `"${adminMessage}"`
                            ) : (
                                <span className="text-blue-500/50">
                                    Belum ada pesan admin.
                                </span>
                            )}
                        </p>
                    </GlassCard>
                </div>

                {/* KHUSUS PEKERJA CASING & RAKIT */}
                {user?.role !== "MESIN" && (
                    <>
                        {/* WIDGET 3: SUPPLY NOTES / LAPORAN ALAT */}
                        <GlassCard
                            delay={0.4}
                            className="xl:col-span-1 flex flex-col h-full border-t-4 border-t-amber-500"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                                    <h2 className="text-sm font-black tracking-widest text-white uppercase">
                                        Laporan Perlengkapan
                                    </h2>
                                </div>
                            </div>

                            {/* Input box */}
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={reportText}
                                    onChange={(e) =>
                                        setReportText(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                        e.key === "Enter" && sendReport()
                                    }
                                    placeholder="Contoh: Kardus sisa 1 ikat..."
                                    className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50"
                                />
                                <button
                                    onClick={sendReport}
                                    className="bg-amber-500/20 text-amber-400 p-3 rounded-xl hover:bg-amber-500 hover:text-black transition-colors shrink-0 flex items-center justify-center"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>

                            <h3 className="text-[10px] font-mono text-gray-500 uppercase mb-2">
                                Riwayat Laporan Saya
                            </h3>

                            {/* History List */}
                            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar min-h-[150px]">
                                {myReports.length === 0 ? (
                                    <div className="text-center text-gray-500 font-mono text-xs py-8 opacity-50">
                                        BELUM ADA LAPORAN
                                    </div>
                                ) : (
                                    myReports.map((report) => (
                                        <div
                                            key={report.id}
                                            className={`rounded-xl p-3 border transition-all ${
                                                report.status === "RESOLVED"
                                                    ? "bg-emerald-500/10 border-emerald-500/30"
                                                    : "bg-white/5 border-white/10"
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <p
                                                    className={`text-sm ${report.status === "RESOLVED" ? "text-emerald-100" : "text-gray-300"}`}
                                                >
                                                    {report.laporan}
                                                </p>
                                                {report.status ===
                                                "RESOLVED" ? (
                                                    <span className="flex items-center gap-1 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full shrink-0 ml-2">
                                                        <Check className="w-3 h-3" />{" "}
                                                        DIBELIKAN
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-[9px] font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full shrink-0 ml-2">
                                                        <Activity className="w-3 h-3" />{" "}
                                                        MENUNGGU
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[9px] font-mono text-gray-500">
                                                {new Date(
                                                    report.timestamp
                                                ).toLocaleTimeString("id-ID", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </GlassCard>

                        {/* WIDGET 4: STASIUN POLES MIKA (Telah Dinonaktifkan sesuai SOP baru) */}
                    </>
                )}

                {/* KHUSUS PEKERJA MESIN (PCB) */}
                {user?.role === "MESIN" && (
                    <>
                        {/* WIDGET: MEJA SERVIS (REWORK LOG) */}
                        <GlassCard
                            delay={0.4}
                            className="xl:col-span-2 border-t-4 border-t-blue-500"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <Wrench className="w-5 h-5 text-blue-400" />
                                <h2 className="text-sm font-black tracking-widest text-white uppercase">
                                    Meja Servis (Rework Log)
                                </h2>
                            </div>
                            <p className="text-[10px] text-gray-400 font-mono mb-4">
                                Klik tag kerusakan di bawah untuk otomatis
                                mencatat PCB yang masuk meja servis.
                            </p>

                            <div className="flex flex-wrap gap-2 mb-4">
                                {MESIN_REWORK_TAGS.map((tag) => (
                                    <button
                                        key={tag}
                                        onClick={() => handleMesinRework(tag)}
                                        className="bg-blue-500/10 border border-blue-500/30 text-blue-300 px-3 py-2 rounded-xl text-xs font-bold hover:bg-blue-500 hover:text-white transition-colors"
                                    >
                                        +1 {tag}
                                    </button>
                                ))}
                            </div>

                            <AnimatePresence>
                                {mesinToast && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={`p-2 rounded-lg text-xs font-mono border ${
                                            mesinToast.type === "success"
                                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                                : "bg-red-500/10 border-red-500/30 text-red-400"
                                        }`}
                                    >
                                        {mesinToast.msg}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="mt-4 border-t border-white/10 pt-4">
                                <h3 className="text-[10px] font-mono text-gray-500 uppercase mb-2">
                                    Riwayat Servis Anda Hari Ini
                                </h3>
                                <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-2">
                                    {myReports.filter((r) =>
                                        r?.laporan?.includes("[SERVIS MESIN]")
                                    ).length === 0 ? (
                                        <div className="text-[10px] text-gray-600 font-mono italic">
                                            Belum ada PCB yang diservis.
                                        </div>
                                    ) : (
                                        myReports
                                            .filter((r) =>
                                                r?.laporan?.includes(
                                                    "[SERVIS MESIN]"
                                                )
                                            )
                                            .map((report) => (
                                                <div
                                                    key={report.id}
                                                    className="text-[10px] font-mono text-gray-300 flex justify-between bg-black/30 px-2 py-1.5 rounded border border-white/5"
                                                >
                                                    <span>
                                                        {report?.laporan?.replace(
                                                            "[SERVIS MESIN] Tindakan: ",
                                                            ""
                                                        )}
                                                    </span>
                                                    <span className="text-gray-500">
                                                        {new Date(
                                                            report.timestamp
                                                        ).toLocaleTimeString(
                                                            "id-ID",
                                                            {
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            }
                                                        )}
                                                    </span>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        </GlassCard>

                        {/* WIDGET: AI SCANNER PLACEHOLDER */}
                        <GlassCard
                            delay={0.5}
                            className="xl:col-span-1 border-t-4 border-t-fuchsia-500 relative overflow-hidden flex flex-col items-center justify-center min-h-[300px]"
                        >
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>

                            <div className="relative z-10 flex flex-col items-center text-center">
                                <div className="w-16 h-16 rounded-full bg-fuchsia-500/20 border-2 border-fuchsia-500/50 flex items-center justify-center mb-4 relative">
                                    <div className="absolute inset-0 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin"></div>
                                    <Target className="w-8 h-8 text-fuchsia-400" />
                                </div>
                                <h3 className="text-sm font-black text-fuchsia-400 uppercase tracking-widest mb-1">
                                    Computer Vision AI
                                </h3>
                                <p className="text-[10px] text-gray-400 font-mono px-4">
                                    Modul Scanner Kamera untuk mendeteksi merk
                                    PCB secara otomatis sedang dalam
                                    pengembangan.
                                </p>
                                <button
                                    disabled
                                    className="mt-4 px-4 py-2 bg-fuchsia-500/20 text-fuchsia-500/50 border border-fuchsia-500/20 rounded-lg text-xs font-bold uppercase cursor-not-allowed"
                                >
                                    Buka Kamera (Coming Soon)
                                </button>
                            </div>
                        </GlassCard>
                    </>
                )}
            </div>
        </div>
    );
}
