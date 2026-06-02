import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    PackageOpen,
    Wrench,
    CheckCircle,
    AlertTriangle,
    Send,
    Plus,
    ArrowRight,
    Save,
    X,
    Archive,
    ArrowUpRight,
} from "lucide-react";
import api from "../api";
import { useSound } from "../hooks/useSound";

const COLUMNS = [
    {
        id: "MENTAH",
        title: "KARUNG MENTAH",
        icon: PackageOpen,
        color: "text-gray-400",
        border: "border-gray-500/30",
        bg: "bg-gray-500/10",
    },
    {
        id: "GUDANG_CUCI",
        title: "GUDANG CUCI",
        icon: Archive,
        color: "text-cyan-400",
        border: "border-cyan-500/30",
        bg: "bg-cyan-500/10",
    },
    {
        id: "GUDANG_KIMIA",
        title: "GUDANG KIMIA",
        icon: Archive,
        color: "text-fuchsia-400",
        border: "border-fuchsia-500/30",
        bg: "bg-fuchsia-500/10",
    },
    {
        id: "GUDANG_CAT",
        title: "GUDANG CAT",
        icon: Archive,
        color: "text-orange-400",
        border: "border-orange-500/30",
        bg: "bg-orange-500/10",
    },
    {
        id: "PROSES_CUCI",
        title: "PROSES CUCI",
        icon: Wrench,
        color: "text-blue-400",
        border: "border-blue-500/30",
        bg: "bg-blue-500/10",
    },
    {
        id: "PROSES_KIMIA",
        title: "PROSES KIMIA",
        icon: Wrench,
        color: "text-pink-400",
        border: "border-pink-500/30",
        bg: "bg-pink-500/10",
    },
    {
        id: "PROSES_CAT",
        title: "PROSES CAT",
        icon: Wrench,
        color: "text-amber-400",
        border: "border-amber-500/30",
        bg: "bg-amber-500/10",
    },
    {
        id: "QC_CEK",
        title: "QC CEK",
        icon: CheckCircle,
        color: "text-indigo-400",
        border: "border-indigo-500/30",
        bg: "bg-indigo-500/10",
    },
    {
        id: "RUSAK",
        title: "RUSAK / GAGAL",
        icon: AlertTriangle,
        color: "text-red-400",
        border: "border-red-500/30",
        bg: "bg-red-500/10",
    },
];

export default function ProductionBoard({ user }) {
    const [jobs, setJobs] = useState([]);
    const [reports, setReports] = useState([]);
    const [reportText, setReportText] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const { playSound } = useSound();

    // Admin form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newJob, setNewJob] = useState({
        merk: "Lain-lain",
        tipe_remote: "",
        komponen: user?.role === "MESIN" ? "MESIN" : "CASING",
        kriteria: "",
        alokasi: 1,
        supplier: "Campuran (Lama)",
    });

    // QC Check popup state
    const [qcJob, setQcJob] = useState(null); // The job currently in QC check popup
    const [qcLulus, setQcLulus] = useState(0);
    const [qcRusak, setQcRusak] = useState(0);
    const [qcRework, setQcRework] = useState(0);
    const [qcCatatan, setQcCatatan] = useState("");
    const [qcModifikasiVarian, setQcModifikasiVarian] = useState("");

    // Sortir popup state
    const [sortirJob, setSortirJob] = useState(null);
    const [sortirCuci, setSortirCuci] = useState(0);
    const [sortirCat, setSortirCat] = useState(0);
    const [sortirKimia, setSortirKimia] = useState(0);

    // Feed State
    const [activeTab, setActiveTab] = useState("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    // Tarik Sortir popup state
    const [tarikJob, setTarikJob] = useState(null);
    const [tarikBagus, setTarikBagus] = useState(0);
    const [tarikRusak, setTarikRusak] = useState(0);
    const [tarikTargetStatus, setTarikTargetStatus] = useState("");

    // Afkir popup state
    const [afkirJob, setAfkirJob] = useState(null);
    const [afkirJumlah, setAfkirJumlah] = useState(0);
    const [afkirCatatan, setAfkirCatatan] = useState("");

    // Constants
    const SUPPLIERS = ["Aziz", "Komeng", "Wakil", "Campuran (Lama)"];
    // Dynamic Merk Options
    const [customMerks, setCustomMerks] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("custom_merks") || "[]");
        } catch {
            return [];
        }
    });

    const MERK_OPTIONS = [
        ...new Set([
            "Panasonic",
            "Daikin",
            "Sharp",
            "Samsung",
            "LG",
            "Universal",
            "Lain-lain",
            ...customMerks,
        ]),
    ];
    const SMART_TAGS_CATEGORIZED = [
        {
            category: "Kelengkapan",
            tags: ["Lengkap", "Tanpa Tutup", "Tanpa Mika"],
        },
        {
            category: "Ukuran",
            tags: ["Kecil", "Sedang", "Panjang", "Besar"],
        },
        {
            category: "Konstruksi",
            tags: ["Baut", "Non-Baut", "Tutup Baut Rendam"],
        },
        {
            category: "Varian / TV",
            tags: ["Original", "Grade A", "Smart TV", "Tabung"],
        },
    ];

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // polling setiap 10 detik
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [resJobs, resSupplies] = await Promise.all([
                api.get("/production/jobs"),
                api.get("/production/supplies"),
            ]);

            if (resJobs.ok) {
                const data = await resJobs.json();
                setJobs(data.jobs);
            }
            if (resSupplies.ok) {
                const data = await resSupplies.json();
                setReports(data.reports);
            }
        } catch (error) {
            console.error("Fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddJob = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post("/production/jobs", newJob);
            if (res.ok) {
                // Save custom merk to LocalStorage if it's new
                if (
                    !MERK_OPTIONS.includes(newJob.merk) &&
                    newJob.merk.trim() !== ""
                ) {
                    const updated = [...customMerks, newJob.merk];
                    setCustomMerks(updated);
                    localStorage.setItem(
                        "custom_merks",
                        JSON.stringify(updated)
                    );
                }

                playSound("success");
                fetchData();
                setShowAddForm(false);
                setNewJob({
                    merk: "Lain-lain",
                    tipe_remote: "",
                    komponen: user?.role === "MESIN" ? "MESIN" : "CASING",
                    kriteria: "",
                    alokasi: 1,
                    supplier: "Campuran (Lama)",
                });
            }
        } catch (error) {
            playSound("error");
        }
    };

    const handleMoveJob = async (jobId, newStatus) => {
        try {
            playSound("click");
            // Optimistic update
            setJobs((prev) =>
                prev.map((j) =>
                    j.id === jobId ? { ...j, status: newStatus } : j
                )
            );
            await api.put(`/production/jobs/${jobId}`, { status: newStatus });
            fetchData();
        } catch (error) {
            playSound("error");
            fetchData(); // revert on fail
        }
    };

    const handleQcSubmit = async () => {
        if (!qcJob) return;
        if (qcLulus + qcRusak + qcRework !== qcJob.alokasi) {
            alert(`Total alokasi harus pas ${qcJob.alokasi}!`);
            return;
        }
        playSound("click");
        try {
            await api.post(`/production/jobs/${qcJob.id}/qc`, {
                qcJual: qcLulus,
                qcRakit: 0,
                qcRusak,
                qcRework,
                catatan: qcCatatan,
                modifikasiVarian: qcModifikasiVarian,
            });
            setQcJob(null);
            fetchData();
        } catch (err) {
            playSound("error");
        }
    };

    const handleSortirSubmit = async () => {
        if (!sortirJob) return;
        playSound("click");
        try {
            await api.post(`/production/jobs/${sortirJob.id}/sortir`, {
                sortirCuci,
                sortirCat,
                sortirKimia,
            });
            setSortirJob(null);
            fetchData();
        } catch (err) {
            playSound("error");
        }
    };

    const handleTarikSubmit = async () => {
        const total = (tarikBagus || 0) + (tarikRusak || 0);
        if (!tarikJob || total <= 0 || total > tarikJob.alokasi) return;

        playSound("click");
        try {
            await api.post(`/production/jobs/${tarikJob.id}/tarik-sortir`, {
                jumlahBagus: tarikBagus,
                jumlahRusak: tarikRusak,
                targetStatus: tarikTargetStatus,
            });
            setTarikJob(null);
            fetchData();
        } catch (err) {
            playSound("error");
        }
    };

    const handleAfkirSubmit = async () => {
        if (!afkirJob || afkirJumlah <= 0 || afkirJumlah > afkirJob.alokasi)
            return;
        playSound("click");
        try {
            await api.post(`/production/jobs/${afkirJob.id}/afkir`, {
                jumlahRusak: afkirJumlah,
                catatan: afkirCatatan,
            });
            setAfkirJob(null);
            fetchData();
        } catch (err) {
            playSound("error");
        }
    };

    const handleTutupBuku = async () => {
        if (
            !confirm(
                "AWAS! Anda akan mengompres data dan MENGHAPUS SEMUA KARTU di kolom Selesai/Rusak. Lanjutkan?"
            )
        )
            return;
        try {
            playSound("click");
            const res = await api.post("/production/tutup-buku");
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            }
        } catch (err) {
            playSound("error");
            console.error(err);
        }
    };

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
                fetchData();
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Filter jobs based on role, tab, and search
    const filteredJobs = jobs.filter((job) => {
        // Role filter
        if (user?.role === "CASING" && job.komponen !== "CASING") return false;
        if (
            user?.role === "MESIN" &&
            job.komponen !== "MESIN" &&
            job.komponen !== "LAYAR"
        )
            return false;

        // Tab filter
        if (activeTab !== "ALL" && job.status !== activeTab) return false;

        // Hide RUSAK for unauthorized roles even in ALL tab
        if (
            job.status === "RUSAK" &&
            user?.role !== "ADMIN" &&
            user?.role !== "CASING"
        )
            return false;

        // Search filter
        if (
            searchQuery &&
            !job.tipe_remote.toLowerCase().includes(searchQuery.toLowerCase())
        )
            return false;

        return true;
    });

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-neon-cyan)] to-blue-500 uppercase">
                        Micro-Factory Board
                    </h1>
                    <p className="text-gray-400 font-mono text-sm mt-1 uppercase">
                        Divisi: {user?.role || "ALL"}
                    </p>
                </div>
                {user?.role === "ADMIN" && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleTutupBuku}
                            className="flex items-center gap-2 bg-red-500/20 text-red-400 px-4 py-2 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all border border-red-500/50"
                        >
                            <Archive className="w-4 h-4" />
                            TUTUP BUKU
                        </button>
                    </div>
                )}
                {(user?.role === "ADMIN" || user?.role === "MESIN") && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex items-center gap-2 bg-[var(--color-neon-cyan)]/20 text-[var(--color-neon-cyan)] px-4 py-2 rounded-xl font-bold hover:bg-[var(--color-neon-cyan)] hover:text-black transition-all border border-[var(--color-neon-cyan)]/50"
                        >
                            {showAddForm ? (
                                <X className="w-4 h-4" />
                            ) : (
                                <Plus className="w-4 h-4" />
                            )}
                            {showAddForm ? "TUTUP" : "INPUT KARUNG MENTAH"}
                        </button>
                    </div>
                )}
            </header>

            {/* Admin Input Form */}
            <AnimatePresence>
                {showAddForm && (
                    <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleAddJob}
                        className="bg-black/50 border border-[var(--color-neon-cyan)]/30 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-6 overflow-hidden"
                    >
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2">
                                    MERK REMOTE
                                </label>
                                <input
                                    list="merk-options"
                                    value={newJob.merk}
                                    onChange={(e) =>
                                        setNewJob({
                                            ...newJob,
                                            merk: e.target.value,
                                        })
                                    }
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[var(--color-neon-cyan)]"
                                    placeholder="Ketik atau pilih merk..."
                                />
                                <datalist id="merk-options">
                                    {MERK_OPTIONS.map((opt) => (
                                        <option key={opt} value={opt} />
                                    ))}
                                </datalist>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2">
                                    TIPE / KODE REMOTE
                                </label>
                                <input
                                    value={newJob.tipe_remote}
                                    onChange={(e) =>
                                        setNewJob({
                                            ...newJob,
                                            tipe_remote: e.target.value,
                                        })
                                    }
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[var(--color-neon-cyan)]"
                                    placeholder="Contoh: A75C2656"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2">
                                    KRITERIA SPESIAL
                                </label>
                                <input
                                    value={newJob.kriteria}
                                    onChange={(e) =>
                                        setNewJob({
                                            ...newJob,
                                            kriteria: e.target.value,
                                        })
                                    }
                                    type="text"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[var(--color-neon-cyan)] mb-2"
                                    placeholder="Ketik manual atau klik tag di bawah..."
                                />
                                <div className="flex flex-col gap-3 mt-3">
                                    {SMART_TAGS_CATEGORIZED.map((group) => (
                                        <div
                                            key={group.category}
                                            className="space-y-1.5"
                                        >
                                            <span className="text-[10px] uppercase text-gray-500 font-bold tracking-wider">
                                                {group.category}
                                            </span>
                                            <div className="flex flex-wrap gap-2">
                                                {group.tags.map((tag) => {
                                                    const isSelected =
                                                        newJob.kriteria?.includes(
                                                            tag
                                                        );
                                                    return (
                                                        <button
                                                            key={tag}
                                                            type="button"
                                                            onClick={() => {
                                                                const current =
                                                                    newJob.kriteria
                                                                        ? newJob.kriteria
                                                                              .split(
                                                                                  ","
                                                                              )
                                                                              .map(
                                                                                  (
                                                                                      s
                                                                                  ) =>
                                                                                      s.trim()
                                                                              )
                                                                              .filter(
                                                                                  (
                                                                                      s
                                                                                  ) =>
                                                                                      s
                                                                              )
                                                                        : [];
                                                                if (
                                                                    isSelected
                                                                ) {
                                                                    setNewJob({
                                                                        ...newJob,
                                                                        kriteria:
                                                                            current
                                                                                .filter(
                                                                                    (
                                                                                        t
                                                                                    ) =>
                                                                                        t !==
                                                                                        tag
                                                                                )
                                                                                .join(
                                                                                    ", "
                                                                                ),
                                                                    });
                                                                } else {
                                                                    setNewJob({
                                                                        ...newJob,
                                                                        kriteria:
                                                                            [
                                                                                ...current,
                                                                                tag,
                                                                            ].join(
                                                                                ", "
                                                                            ),
                                                                    });
                                                                }
                                                            }}
                                                            className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-all ${isSelected ? "bg-[var(--color-neon-cyan)]/20 text-[var(--color-neon-cyan)] border-[var(--color-neon-cyan)]" : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white"}`}
                                                        >
                                                            {isSelected
                                                                ? "✓ "
                                                                : "+ "}
                                                            {tag}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2">
                                        KOMPONEN
                                    </label>
                                    {user?.role === "MESIN" ? (
                                        <div className="w-full bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-blue-400 font-bold cursor-not-allowed">
                                            MESIN (PCB)
                                        </div>
                                    ) : (
                                        <select
                                            value={newJob.komponen}
                                            onChange={(e) =>
                                                setNewJob({
                                                    ...newJob,
                                                    komponen: e.target.value,
                                                })
                                            }
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[var(--color-neon-cyan)]"
                                        >
                                            <option
                                                className="bg-gray-900"
                                                value="CASING"
                                            >
                                                CASING (Body)
                                            </option>
                                            <option
                                                className="bg-gray-900"
                                                value="TUTUP BATERAI"
                                            >
                                                TUTUP BATERAI
                                            </option>
                                            <option
                                                className="bg-gray-900"
                                                value="MIKA"
                                            >
                                                MIKA (Sensor/Layar)
                                            </option>
                                            <option
                                                className="bg-gray-900"
                                                value="MESIN"
                                            >
                                                MESIN (PCB)
                                            </option>
                                            <option
                                                className="bg-gray-900"
                                                value="KARET"
                                            >
                                                KARET (Keypad)
                                            </option>
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-2">
                                        JUMLAH (PCS)
                                    </label>
                                    <input
                                        required
                                        value={newJob.alokasi}
                                        onChange={(e) =>
                                            setNewJob({
                                                ...newJob,
                                                alokasi: parseInt(
                                                    e.target.value
                                                ),
                                            })
                                        }
                                        type="number"
                                        min="1"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2">
                                    SUPPLIER
                                </label>
                                <select
                                    value={newJob.supplier}
                                    onChange={(e) =>
                                        setNewJob({
                                            ...newJob,
                                            supplier: e.target.value,
                                        })
                                    }
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[var(--color-neon-cyan)]"
                                >
                                    {SUPPLIERS.map((s) => (
                                        <option
                                            key={s}
                                            value={s}
                                            className="bg-gray-900"
                                        >
                                            {s}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="submit"
                                className="w-full h-[48px] bg-[var(--color-neon-cyan)] text-black font-bold rounded-lg hover:shadow-[0_0_15px_rgba(0,243,255,0.5)] transition-all flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" /> SIMPAN KARUNG
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* Smart Navigation & Search */}
            <div className="bg-[#111] border border-white/10 rounded-2xl p-4 sticky top-4 z-40 shadow-xl space-y-4">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="🔍 Cari tipe remote (misal: A75C)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-neon-cyan)] transition-colors text-lg font-bold shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                    />
                </div>

                {/* Horizontal Scrollable Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                        onClick={() => setActiveTab("ALL")}
                        className={`flex-shrink-0 px-4 py-2 rounded-full font-bold text-xs transition-all border ${activeTab === "ALL" ? "bg-white text-black border-white" : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"}`}
                    >
                        SEMUA TUGAS
                    </button>
                    {COLUMNS.filter((col) => {
                        // Logika Filter Khusus Pekerja Mesin (PCB)
                        if (user?.role === "MESIN") {
                            const allowedForMesin = [
                                "MENTAH",
                                "QC_CEK",
                                "RUSAK",
                            ];
                            if (!allowedForMesin.includes(col.id)) return false;
                        } else {
                            // Sembunyikan kolom RUSAK untuk selain Admin dan Casing/Mesin
                            if (
                                col.id === "RUSAK" &&
                                user?.role !== "ADMIN" &&
                                user?.role !== "CASING"
                            ) {
                                return false;
                            }

                            // Sembunyikan kolom QC CEK untuk selain Admin
                            if (col.id === "QC_CEK" && user?.role !== "ADMIN") {
                                return false;
                            }
                        }

                        return true;
                    }).map((col) => {
                        const count = jobs.filter(
                            (j) => j.status === col.id
                        ).length;
                        return (
                            <button
                                key={col.id}
                                onClick={() => setActiveTab(col.id)}
                                className={`flex-shrink-0 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 transition-all border ${activeTab === col.id ? `${col.bg} ${col.border} ${col.color}` : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"}`}
                            >
                                <col.icon className="w-3 h-3" />
                                {col.title}
                                <span className="bg-black/50 px-1.5 rounded-md">
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* Vertical Task Feed (Takes 3 columns on large screens) */}
                <div className="lg:col-span-3 space-y-3 pb-20">
                    {filteredJobs.length === 0 ? (
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-gray-500 shadow-lg">
                            <Archive className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-mono text-sm">
                                TIDAK ADA TUGAS DITEMUKAN
                            </p>
                        </div>
                    ) : (
                        filteredJobs.map((job) => {
                            const colConfig =
                                COLUMNS.find((c) => c.id === job.status) ||
                                COLUMNS[0];
                            const Icon = colConfig.icon;

                            return (
                                <motion.div
                                    layoutId={job.id}
                                    key={job.id}
                                    className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4 hover:border-white/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group shadow-md hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                                >
                                    <div className="flex items-start sm:items-center gap-4 min-w-0 w-full">
                                        <div
                                            className={`p-3 rounded-xl ${colConfig.bg} ${colConfig.border} border shadow-inner shrink-0 mt-1 sm:mt-0`}
                                        >
                                            <Icon
                                                className={`w-6 h-6 ${colConfig.color}`}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2 mb-1">
                                                <h3 className="text-[var(--color-neon-cyan)] font-bold font-mono tracking-wider text-sm sm:text-base break-words min-w-0">
                                                    <span className="text-xs text-gray-400 mr-2">
                                                        [
                                                        {job.merk?.toUpperCase() ||
                                                            "LAIN-LAIN"}
                                                        ]
                                                    </span>
                                                    {job.tipe_remote}
                                                </h3>
                                                <span
                                                    className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider
                                                    ${
                                                        job.komponen ===
                                                        "CASING"
                                                            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                                            : job.komponen ===
                                                                "TUTUP BATERAI"
                                                              ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                                                              : job.komponen ===
                                                                  "MIKA"
                                                                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                                                : job.komponen ===
                                                                    "MESIN"
                                                                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                                                                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                    }`}
                                                >
                                                    {job.komponen}
                                                </span>
                                                {job.supplier && (
                                                    <span
                                                        className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${job.supplier === "Campuran (Lama)" ? "bg-gray-500/20 text-gray-400" : "bg-green-500/20 text-green-400"}`}
                                                    >
                                                        🏭 {job.supplier}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                                <span
                                                    className={`${colConfig.color} font-bold flex items-center gap-1`}
                                                >
                                                    • {colConfig.title}
                                                </span>
                                                <span className="text-gray-400 font-mono bg-black/50 border border-white/5 px-2 py-0.5 rounded-md">
                                                    {job.alokasi} pcs
                                                </span>
                                                {job.kriteria && (
                                                    <span className="text-gray-400 italic">
                                                        📝 {job.kriteria}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons based on status */}
                                    <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-2 sm:mt-0 min-w-max">
                                        {job.status === "MENTAH" && (
                                            <button
                                                onClick={() => {
                                                    setSortirJob(job);
                                                    setSortirCuci(0);
                                                    setSortirCat(0);
                                                    setSortirKimia(0);
                                                }}
                                                className="w-full sm:w-auto px-4 py-2.5 text-xs bg-gray-500/10 text-gray-300 rounded-lg font-bold hover:bg-gray-500/30 hover:text-white transition-colors border border-gray-500/30"
                                            >
                                                BONGKAR & SORTIR
                                            </button>
                                        )}
                                        {job.status === "GUDANG_CUCI" && (
                                            <button
                                                onClick={() => {
                                                    setTarikJob(job);
                                                    setTarikBagus(job.alokasi);
                                                    setTarikRusak(0);
                                                    setTarikTargetStatus(
                                                        "PROSES_CUCI"
                                                    );
                                                }}
                                                className="w-full sm:w-auto px-4 py-2.5 text-xs bg-cyan-500/10 text-cyan-400 rounded-lg font-bold hover:bg-cyan-500/30 hover:text-cyan-300 transition-colors border border-cyan-500/30"
                                            >
                                                TARIK KE CUCI (SORTIR)
                                            </button>
                                        )}
                                        {job.status === "GUDANG_CAT" && (
                                            <button
                                                onClick={() => {
                                                    setTarikJob(job);
                                                    setTarikBagus(job.alokasi);
                                                    setTarikRusak(0);
                                                    setTarikTargetStatus(
                                                        "PROSES_CAT"
                                                    );
                                                }}
                                                className="w-full sm:w-auto px-4 py-2.5 text-xs bg-orange-500/10 text-orange-400 rounded-lg font-bold hover:bg-orange-500/30 hover:text-orange-300 transition-colors border border-orange-500/30"
                                            >
                                                Tarik ke Proses Cat (Sortir)
                                            </button>
                                        )}
                                        {job.status === "GUDANG_KIMIA" && (
                                            <button
                                                onClick={() => {
                                                    setTarikJob(job);
                                                    setTarikBagus(job.alokasi);
                                                    setTarikRusak(0);
                                                    setTarikTargetStatus(
                                                        "PROSES_KIMIA"
                                                    );
                                                }}
                                                className="w-full sm:w-auto px-4 py-2.5 text-xs bg-fuchsia-500/10 text-fuchsia-400 rounded-lg font-bold hover:bg-fuchsia-500/30 hover:text-fuchsia-300 transition-colors border border-fuchsia-500/30"
                                            >
                                                Tarik ke Proses Kimia (Sortir)
                                            </button>
                                        )}
                                        {job.status === "PROSES_CUCI" && (
                                            <button
                                                onClick={() =>
                                                    handleMoveJob(
                                                        job.id,
                                                        "QC_CEK"
                                                    )
                                                }
                                                className="w-full sm:w-auto px-4 py-2.5 text-xs bg-blue-500/10 text-blue-400 rounded-lg font-bold hover:bg-blue-500/30 hover:text-blue-300 transition-colors border border-blue-500/30"
                                            >
                                                ✓ Selesai Cuci (Kirim QC)
                                            </button>
                                        )}
                                        {job.status === "PROSES_CAT" && (
                                            <button
                                                onClick={() =>
                                                    handleMoveJob(
                                                        job.id,
                                                        "QC_CEK"
                                                    )
                                                }
                                                className="w-full sm:w-auto px-4 py-2.5 text-xs bg-amber-500/10 text-amber-400 rounded-lg font-bold hover:bg-amber-500/30 hover:text-amber-300 transition-colors border border-amber-500/30"
                                            >
                                                ✓ Selesai Cat (Kirim QC)
                                            </button>
                                        )}
                                        {job.status === "PROSES_KIMIA" && (
                                            <button
                                                onClick={() =>
                                                    handleMoveJob(
                                                        job.id,
                                                        "PROSES_CAT"
                                                    )
                                                }
                                                className="w-full sm:w-auto px-4 py-2.5 text-xs bg-pink-500/10 text-pink-400 rounded-lg font-bold hover:bg-pink-500/30 hover:text-pink-300 transition-colors border border-pink-500/30"
                                            >
                                                ✓ Selesai Kimia (Lanjut Proses
                                                Cat)
                                            </button>
                                        )}
                                        {job.status === "QC_CEK" && (
                                            <button
                                                onClick={() => {
                                                    setQcJob(job);
                                                    setQcJual(0);
                                                    setQcRakit(0);
                                                    setQcRusak(0);
                                                    setQcRework(0);
                                                    setQcCatatan("");
                                                    setQcModifikasiVarian("");
                                                }}
                                                className="w-full sm:w-auto px-4 py-2.5 text-xs bg-[var(--color-neon-cyan)]/10 text-[var(--color-neon-cyan)] rounded-lg font-bold hover:bg-[var(--color-neon-cyan)]/30 hover:text-white transition-colors border border-[var(--color-neon-cyan)]/30 shadow-[0_0_10px_rgba(0,243,255,0.1)]"
                                            >
                                                ALOKASI QC
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>

                {/* Supply Reports Side Panel */}
                <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[70vh]">
                    <div className="p-4 border-b border-white/10 bg-white/5">
                        <h3 className="font-black tracking-widest text-white flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                            SUPPLY NOTES
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {reports.map((report) => (
                            <div
                                key={report.id}
                                className="bg-white/5 rounded-xl p-3 border border-white/5"
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-gray-300">
                                        @{report.pekerja}
                                    </span>
                                    <span
                                        className={`text-[9px] px-1.5 py-0.5 rounded ${report.status === "RESOLVED" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}
                                    >
                                        {report.status}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-400">
                                    {report.laporan}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-white/10 bg-white/5">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={reportText}
                                onChange={(e) => setReportText(e.target.value)}
                                onKeyDown={(e) =>
                                    e.key === "Enter" && sendReport()
                                }
                                placeholder="Lapor barang habis..."
                                className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-neon-cyan)]"
                            />
                            <button
                                onClick={sendReport}
                                className="bg-[var(--color-neon-cyan)]/20 text-[var(--color-neon-cyan)] p-2 rounded-lg hover:bg-[var(--color-neon-cyan)] hover:text-black transition-colors"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sortir Modal */}
            <AnimatePresence>
                {sortirJob && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#111] border border-white/20 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
                        >
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-gray-500/10">
                                <h3 className="font-black text-gray-300 tracking-wider">
                                    BONGKAR KARUNG (Total: {sortirJob.alokasi})
                                </h3>
                                <button
                                    onClick={() => setSortirJob(null)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-cyan-400 block mb-1">
                                            Ke Gudang Cuci (Cuci Saja)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max={sortirJob.alokasi}
                                            value={sortirCuci}
                                            onChange={(e) =>
                                                setSortirCuci(
                                                    parseInt(e.target.value) ||
                                                        0
                                                )
                                            }
                                            className="w-full bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-3 text-white text-lg font-bold focus:outline-none focus:border-cyan-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-orange-400 block mb-1">
                                            Ke Gudang Cat (Perlu Cat Semprot)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max={sortirJob.alokasi}
                                            value={sortirCat}
                                            onChange={(e) =>
                                                setSortirCat(
                                                    parseInt(e.target.value) ||
                                                        0
                                                )
                                            }
                                            className="w-full bg-orange-900/20 border border-orange-500/30 rounded-lg p-3 text-white text-lg font-bold focus:outline-none focus:border-orange-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-fuchsia-400 block mb-1">
                                            Ke Gudang Kimia (Rendam Pemutih)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            max={sortirJob.alokasi}
                                            value={sortirKimia}
                                            onChange={(e) =>
                                                setSortirKimia(
                                                    parseInt(e.target.value) ||
                                                        0
                                                )
                                            }
                                            className="w-full bg-fuchsia-900/20 border border-fuchsia-500/30 rounded-lg p-3 text-white text-lg font-bold focus:outline-none focus:border-fuchsia-400"
                                        />
                                    </div>
                                </div>

                                <div
                                    className={`p-4 rounded-xl border ${sortirCuci + sortirCat + sortirKimia === sortirJob.alokasi ? "bg-emerald-900/20 border-emerald-500/30 text-emerald-400" : "bg-red-900/20 border-red-500/30 text-red-400"}`}
                                >
                                    <div className="flex justify-between items-center font-bold">
                                        <span>Total Terbagi:</span>
                                        <span>
                                            {sortirCuci +
                                                sortirCat +
                                                sortirKimia}{" "}
                                            / {sortirJob.alokasi}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSortirSubmit}
                                    className="w-full bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-500 transition-colors"
                                >
                                    SIMPAN KE GUDANG
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* QC Allocation Modal */}
            <AnimatePresence>
                {qcJob && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#111] border border-white/20 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
                        >
                            <div className="p-4 border-b border-indigo-500/20 flex justify-between items-center bg-indigo-500/10">
                                <h3 className="font-black text-indigo-400 tracking-wider">
                                    ALOKASI QC (Total: {qcJob.alokasi})
                                </h3>
                                <button
                                    onClick={() => setQcJob(null)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="text-xs font-bold text-emerald-400 block mb-1">
                                        Bagus - Lulus QC (Otomatis Masuk
                                        Inventory)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max={qcJob.alokasi}
                                        value={qcLulus}
                                        onChange={(e) =>
                                            setQcLulus(
                                                parseInt(e.target.value) || 0
                                            )
                                        }
                                        className="w-full bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 text-white text-lg font-bold focus:outline-none focus:border-emerald-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-red-400 block mb-1">
                                        Rusak / Gagal QC (Afkir)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max={qcJob.alokasi}
                                        value={qcRusak}
                                        onChange={(e) =>
                                            setQcRusak(
                                                parseInt(e.target.value) || 0
                                            )
                                        }
                                        className="w-full bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-white text-lg font-bold focus:outline-none focus:border-red-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-orange-400 block mb-1">
                                        Perbaiki Ulang (Rework ke Gudang Cat)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max={qcJob.alokasi}
                                        value={qcRework}
                                        onChange={(e) =>
                                            setQcRework(
                                                parseInt(e.target.value) || 0
                                            )
                                        }
                                        className="w-full bg-orange-900/20 border border-orange-500/30 rounded-lg p-3 text-white text-lg font-bold focus:outline-none focus:border-orange-400"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 block mb-1">
                                        Alasan Rework / Kendala (Opsional)
                                    </label>
                                    <input
                                        type="text"
                                        value={qcCatatan}
                                        onChange={(e) =>
                                            setQcCatatan(e.target.value)
                                        }
                                        placeholder="Misal: Cat terkelupas"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-white/30"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-cyan-400 block mb-1">
                                        Modifikasi Varian Lulus (Opsional)
                                    </label>
                                    <div className="flex gap-2 mb-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setQcModifikasiVarian(
                                                    "(Tanpa Mika)"
                                                )
                                            }
                                            className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded border border-cyan-500/30 hover:bg-cyan-500/40"
                                        >
                                            + (Tanpa Mika)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setQcModifikasiVarian(
                                                    "(Tanpa Tutup)"
                                                )
                                            }
                                            className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded border border-cyan-500/30 hover:bg-cyan-500/40"
                                        >
                                            + (Tanpa Tutup)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setQcModifikasiVarian("")
                                            }
                                            className="text-[10px] bg-gray-500/20 text-gray-400 px-2 py-1 rounded border border-gray-500/30 hover:bg-gray-500/40"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={qcModifikasiVarian}
                                        onChange={(e) =>
                                            setQcModifikasiVarian(
                                                e.target.value
                                            )
                                        }
                                        placeholder="Ketik tag varian khusus..."
                                        className="w-full bg-cyan-900/10 border border-cyan-500/20 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-cyan-400"
                                    />
                                    {qcModifikasiVarian && (
                                        <p className="text-[10px] text-cyan-400 mt-1 italic">
                                            Nama barang saat dikirim ke pekerja
                                            & inventory akan menjadi:
                                            <br />
                                            <strong className="text-white">
                                                {qcJob.tipe_remote}{" "}
                                                {qcModifikasiVarian}
                                            </strong>
                                        </p>
                                    )}
                                </div>

                                <div
                                    className={`p-4 rounded-xl border ${qcLulus + qcRusak + qcRework === qcJob.alokasi ? "bg-indigo-900/20 border-indigo-500/30 text-indigo-400" : "bg-red-900/20 border-red-500/30 text-red-400"}`}
                                >
                                    <div className="flex justify-between items-center font-bold">
                                        <span>Total Terbagi:</span>
                                        <span>
                                            {qcLulus + qcRusak + qcRework} /{" "}
                                            {qcJob.alokasi}
                                        </span>
                                    </div>
                                </div>

                                {qcLulus + qcRusak + qcRework !==
                                Number(qcJob.alokasi) ? (
                                    <div className="text-red-400 text-xs text-center font-bold">
                                        TOTAL HARUS PAS {qcJob.alokasi}!
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleQcSubmit}
                                        className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-500 transition-colors"
                                    >
                                        SELESAIKAN QC
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Tarik Parsial Modal */}
            <AnimatePresence>
                {tarikJob && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#111] border border-white/20 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
                        >
                            <div
                                className={`p-4 border-b border-white/10 flex justify-between items-center ${tarikTargetStatus === "PROSES_CUCI" ? "bg-cyan-500/10" : tarikTargetStatus === "PROSES_KIMIA" ? "bg-fuchsia-500/10" : "bg-orange-500/10"}`}
                            >
                                <h3
                                    className={`font-black tracking-wider ${tarikTargetStatus === "PROSES_CUCI" ? "text-cyan-400" : tarikTargetStatus === "PROSES_KIMIA" ? "text-fuchsia-400" : "text-orange-400"}`}
                                >
                                    TARIK KE PROSES (Max: {tarikJob.alokasi})
                                </h3>
                                <button
                                    onClick={() => setTarikJob(null)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl mb-4">
                                    <p className="text-xs text-blue-300 font-medium">
                                        Lakukan sortir fisik terlebih dahulu.
                                        Pisahkan barang yang bagus dan cacat
                                        sebelum ditarik ke meja proses.
                                    </p>
                                </div>

                                <div>
                                    <label className="flex justify-between text-xs font-bold text-emerald-400 mb-2">
                                        BAGUS (Lanjut ke Proses)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max={tarikJob.alokasi}
                                        value={tarikBagus}
                                        onChange={(e) =>
                                            setTarikBagus(
                                                parseInt(e.target.value) || 0
                                            )
                                        }
                                        className="w-full bg-black/50 border rounded-lg p-3 font-mono text-lg text-center text-emerald-400 border-emerald-500/30 focus:border-emerald-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="flex justify-between text-xs font-bold text-red-400 mb-2">
                                        RUSAK / RETAK (Buang ke Gudang Rusak)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max={tarikJob.alokasi}
                                        value={tarikRusak}
                                        onChange={(e) =>
                                            setTarikRusak(
                                                parseInt(e.target.value) || 0
                                            )
                                        }
                                        className="w-full bg-black/50 border rounded-lg p-3 font-mono text-lg text-center text-red-400 border-red-500/30 focus:border-red-500 outline-none"
                                    />
                                </div>

                                <div className="flex justify-between items-center text-xs font-bold text-gray-400 pt-2 border-t border-white/10">
                                    <span>Total Ditarik:</span>
                                    <span
                                        className={
                                            tarikBagus + tarikRusak >
                                            tarikJob.alokasi
                                                ? "text-red-400"
                                                : "text-white"
                                        }
                                    >
                                        {tarikBagus + tarikRusak} /{" "}
                                        {tarikJob.alokasi}
                                    </span>
                                </div>

                                {tarikBagus + tarikRusak <= 0 ||
                                tarikBagus + tarikRusak > tarikJob.alokasi ? (
                                    <div className="text-red-400 text-xs text-center font-bold mt-4">
                                        TOTAL JUMLAH TIDAK VALID!
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleTarikSubmit}
                                        className={`w-full mt-4 text-white font-bold py-3 rounded-lg transition-colors ${tarikTargetStatus === "PROSES_CUCI" ? "bg-cyan-600 hover:bg-cyan-500" : tarikTargetStatus === "PROSES_KIMIA" ? "bg-fuchsia-600 hover:bg-fuchsia-500" : "bg-orange-600 hover:bg-orange-500"}`}
                                    >
                                        Simpan & Tarik {tarikBagus + tarikRusak}{" "}
                                        Pcs
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Lapor Rusak (Afkir) Modal */}
            <AnimatePresence>
                {afkirJob && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#111] border border-white/20 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
                        >
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-red-500/10">
                                <h3 className="font-black text-red-400 tracking-wider flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> LAPOR
                                    RUSAK (Max: {afkirJob.alokasi})
                                </h3>
                                <button
                                    onClick={() => setAfkirJob(null)}
                                    className="text-gray-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                                        JUMLAH BARANG RUSAK
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max={afkirJob.alokasi}
                                        value={afkirJumlah}
                                        onChange={(e) =>
                                            setAfkirJumlah(
                                                parseInt(e.target.value) || 0
                                            )
                                        }
                                        className="w-full bg-white/5 border border-red-500/30 rounded-lg p-3 font-mono text-lg text-center text-red-400 focus:border-red-400 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                                        CATATAN KENDALA (Opsional)
                                    </label>
                                    <input
                                        type="text"
                                        value={afkirCatatan}
                                        onChange={(e) =>
                                            setAfkirCatatan(e.target.value)
                                        }
                                        placeholder="Casing retak / tulisan pudar..."
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-400 focus:outline-none"
                                    />
                                </div>

                                {afkirJumlah <= 0 ||
                                afkirJumlah > afkirJob.alokasi ? (
                                    <div className="text-red-400 text-xs text-center font-bold">
                                        JUMLAH TIDAK VALID!
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleAfkirSubmit}
                                        className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-500 transition-colors mt-2"
                                    >
                                        BUANG KE TONG RUSAK
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
