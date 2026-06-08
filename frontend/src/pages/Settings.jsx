import { useState, useEffect } from "react";
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from "framer-motion";
import {
    Settings as SettingsIcon,
    Palette,
    Volume2,
    VolumeX,
    Monitor,
    Info,
    Cpu,
    ShieldCheck,
    Zap,
    Check,
    Bell,
    BellOff,
    Send,
    ScanLine,
    Plus,
    Trash2,
    Save,
    RefreshCw,
    MessageSquare,
    AlertTriangle,
} from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { usePushNotification } from "../hooks/usePushNotification";
import api from "../api";

/* ─── Accent color palette ─── */
const ACCENT_THEMES = [
    {
        id: "cyan",
        label: "DEFAULT",
        color: "#00f3ff",
        color2: "#bc13fe",
        bg: "rgba(0,243,255,0.08)",
    },
    {
        id: "synthwave",
        label: "SYNTHWAVE",
        color: "#ec4899",
        color2: "#f97316",
        bg: "rgba(236,72,153,0.08)",
    },
    {
        id: "matrix",
        label: "BIO-MATRIX",
        color: "#22c55e",
        color2: "#14b8a6",
        bg: "rgba(34,197,94,0.08)",
    },
    {
        id: "imperial",
        label: "IMPERIAL",
        color: "#fbbf24",
        color2: "#ef4444",
        bg: "rgba(251,191,36,0.08)",
    },
    {
        id: "void",
        label: "DEEP VOID",
        color: "#3b82f6",
        color2: "#6366f1",
        bg: "rgba(59,130,246,0.08)",
    },
    {
        id: "sith",
        label: "DANGER",
        color: "#dc2626",
        color2: "#ea580c",
        bg: "rgba(220,38,38,0.08)",
    },
];

export default function Settings() {
    const { settings, toggleSetting, setSetting } = useSettings();
    const [hoveredAccent, setHoveredAccent] = useState(null);
    const push = usePushNotification();

    // ─── Prefix Rules State ─────────────────────────────────────────────────
    const [prefixRules, setPrefixRules] = useState([]);
    const [prefixLoading, setPrefixLoading] = useState(true);
    const [prefixSaving, setPrefixSaving] = useState(false);
    const [prefixDirty, setPrefixDirty] = useState(false);
    const [prefixToast, setPrefixToast] = useState(null);
    const [newPrefix, setNewPrefix] = useState({
        prefix: "",
        brand: "",
        type: "Remote AC",
        confidence: "high",
    });

    // ─── Admin Message State ────────────────────────────────────────────────
    const [adminMessage, setAdminMessage] = useState("");
    const [adminMessageSaving, setAdminMessageSaving] = useState(false);
    const [adminMessageToast, setAdminMessageToast] = useState(null);

    // ─── Recipes State ──────────────────────────────────────────────────────
    const [recipes, setRecipes] = useState([]);
    const [recipeToast, setRecipeToast] = useState(null);
    const [newRecipe, setNewRecipe] = useState({
        tipe_remote: "",
        jenis_tutup: "Tutup Baut",
        jenis_mika: "Mika Default",
    });

    // Fetch config & prefix rules saat pertama kali
    useEffect(() => {
        (async () => {
            try {
                const [resPrefixes, resConfig, resRecipes] = await Promise.all([
                    api.get("/settings/prefixes"),
                    api.get("/settings/config"),
                    api.get("/settings/recipes"),
                ]);

                if (resPrefixes.ok) {
                    const data = await resPrefixes.json();
                    setPrefixRules(data.rules || []);
                }

                if (resConfig.ok) {
                    const data = await resConfig.json();
                    setAdminMessage(data.adminMessage || "");
                }

                if (resRecipes.ok) {
                    const data = await resRecipes.json();
                    setRecipes(data.recipes || []);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setPrefixLoading(false);
            }
        })();
    }, []);

    const saveAdminMessage = async () => {
        setAdminMessageSaving(true);
        try {
            const res = await api.put("/settings/config", { adminMessage });
            if (res.ok) {
                setAdminMessageToast({
                    msg: "Pesan admin tersimpan!",
                    type: "success",
                });
            } else {
                setAdminMessageToast({
                    msg: "Gagal menyimpan pesan",
                    type: "error",
                });
            }
        } catch (e) {
            setAdminMessageToast({ msg: "Kesalahan jaringan", type: "error" });
        } finally {
            setAdminMessageSaving(false);
            setTimeout(() => setAdminMessageToast(null), 3000);
        }
    };

    const savePrefixRules = async (rules) => {
        setPrefixSaving(true);
        try {
            const res = await api.put("/settings/prefixes", { rules });
            if (res.ok) {
                setPrefixDirty(false);
                setPrefixToast({
                    msg: "Prefix rules tersimpan!",
                    type: "success",
                });
            } else {
                const err = await res.json();
                setPrefixToast({
                    msg: err.error || "Gagal menyimpan",
                    type: "error",
                });
            }
        } catch (e) {
            setPrefixToast({ msg: "Network error", type: "error" });
        }
        setPrefixSaving(false);
        setTimeout(() => setPrefixToast(null), 3000);
    };

    const addPrefixRule = () => {
        if (!newPrefix.prefix.trim() || !newPrefix.brand.trim()) return;
        const updated = [
            ...prefixRules,
            {
                ...newPrefix,
                prefix: newPrefix.prefix.trim().toUpperCase(),
                brand: newPrefix.brand.trim(),
            },
        ];
        setPrefixRules(updated);
        setPrefixDirty(true);
        setNewPrefix({
            prefix: "",
            brand: "",
            type: "Remote AC",
            confidence: "high",
        });
    };

    const removePrefixRule = (index) => {
        const updated = prefixRules.filter((_, i) => i !== index);
        setPrefixRules(updated);
        setPrefixDirty(true);
    };

    const addRecipe = async () => {
        if (!newRecipe.tipe_remote.trim()) return;
        try {
            const res = await api.post("/settings/recipes", newRecipe);
            const data = await res.json();
            if (res.ok && data.success) {
                setRecipes([...recipes, data.recipe]);
                setNewRecipe({
                    tipe_remote: "",
                    jenis_tutup: "Tutup Baut",
                    jenis_mika: "Mika Default",
                });
                setRecipeToast({ msg: "Resep ditambahkan!", type: "success" });
            } else {
                setRecipeToast({
                    msg: data.error || "Gagal menambah",
                    type: "error",
                });
            }
        } catch (e) {
            setRecipeToast({ msg: "Network error", type: "error" });
        }
        setTimeout(() => setRecipeToast(null), 3000);
    };

    const removeRecipe = async (id) => {
        try {
            const res = await api.delete(`/settings/recipes/${id}`);
            if (res.ok) {
                setRecipes(recipes.filter((r) => r.id !== id));
            } else {
                setRecipeToast({ msg: "Gagal menghapus", type: "error" });
                setTimeout(() => setRecipeToast(null), 3000);
            }
        } catch (e) {
            setRecipeToast({ msg: "Network error", type: "error" });
            setTimeout(() => setRecipeToast(null), 3000);
        }
    };

    const togglePrefixConfidence = (index) => {
        const updated = [...prefixRules];
        const current = updated[index].confidence;
        // Cycle: high → medium → low → high
        updated[index].confidence =
            current === "high"
                ? "medium"
                : current === "medium"
                  ? "low"
                  : "high";
        setPrefixRules(updated);
        setPrefixDirty(true);
    };

    const toggle = (key) => toggleSetting(key);
    const setAccent = (theme) => setSetting("accentTheme", theme);

    const activeAccent =
        ACCENT_THEMES.find((t) => t.id === settings.accentTheme) ??
        ACCENT_THEMES[0];

    const confidenceColors = {
        high: {
            label: "AUTO",
            color: "#22c55e",
            desc: "Langsung klasifikasi otomatis",
        },
        medium: {
            label: "MEDIUM",
            color: "#f59e0b",
            desc: "Auto-klasifikasi dengan peringatan",
        },
        low: {
            label: "TANYA",
            color: "#f43f5e",
            desc: "Hermes tidak auto-klasifikasi, minta konfirmasi Anda",
        },
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-10">
            {/* ── Page Header ── */}
            <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <div className="flex items-center gap-3 mb-1">
                    <div
                        className="p-2 rounded-xl border border-white/10 bg-white/5"
                        style={{
                            boxShadow: `0 0 18px ${activeAccent.color}33`,
                        }}
                    >
                        <SettingsIcon
                            className="w-5 h-5"
                            style={{ color: activeAccent.color }}
                        />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">
                            System Settings
                        </h2>
                        <p className="text-[11px] font-mono text-gray-600 mt-0.5">
                            Configuration persisted to localStorage
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* ── Section: Display ── */}
            <Section label="DISPLAY & PERFORMANCE" icon={Monitor} delay={0.05}>
                {/* Low Graphics Mode */}
                <SettingRow
                    icon={Cpu}
                    iconBg="rgba(0,243,255,0.12)"
                    iconColor="var(--color-neon-cyan)"
                    title="Low Graphics Mode"
                    description="Nonaktifkan animasi berat & efek blur untuk performa maksimal di perangkat lama atau HP."
                    badge={
                        settings.lowGraphics
                            ? { label: "AKTIF", color: "#00f3ff" }
                            : { label: "NONAKTIF", color: "#555" }
                    }
                >
                    <ToggleSwitch
                        enabled={settings.lowGraphics}
                        onToggle={() => toggle("lowGraphics")}
                        activeColor="var(--color-neon-cyan)"
                        id="toggle-low-graphics"
                    />
                </SettingRow>

                {/* Sound Effects */}
                <SettingRow
                    icon={settings.soundEnabled ? Volume2 : VolumeX}
                    iconBg="rgba(188,19,254,0.12)"
                    iconColor="var(--color-neon-purple)"
                    title="Sound Effects"
                    description="Aktifkan atau nonaktifkan efek suara UI dan notifikasi audio pada antarmuka."
                    badge={
                        settings.soundEnabled
                            ? { label: "ON", color: "#bc13fe" }
                            : { label: "OFF", color: "#555" }
                    }
                >
                    <ToggleSwitch
                        enabled={settings.soundEnabled}
                        onToggle={() => toggle("soundEnabled")}
                        activeColor="var(--color-neon-purple)"
                        id="toggle-sound"
                    />
                </SettingRow>
            </Section>

            {/* ── Section: Accent Theme ── */}
            <Section label="TEMA WARNA AKSEN" icon={Palette} delay={0.15}>
                <div className="p-5">
                    {/* Preview strip */}
                    <div className="flex items-center gap-2 mb-5 text-xs font-mono text-gray-500">
                        <span>Warna aktif:</span>
                        <span
                            className="font-bold tracking-widest px-2 py-0.5 rounded-md text-[10px]"
                            style={{
                                color: activeAccent.color,
                                backgroundColor: activeAccent.bg,
                                border: `1px solid ${activeAccent.color}40`,
                            }}
                        >
                            {activeAccent.label}
                        </span>
                    </div>

                    {/* Color grid */}
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                        {ACCENT_THEMES.map((theme, i) => {
                            const isActive = settings.accentTheme === theme.id;
                            const isHovered = hoveredAccent === theme.id;
                            return (
                                <motion.button
                                    key={theme.id}
                                    id={`accent-${theme.id}`}
                                    onClick={() => setAccent(theme.id)}
                                    onMouseEnter={() =>
                                        setHoveredAccent(theme.id)
                                    }
                                    onMouseLeave={() => setHoveredAccent(null)}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.04 + 0.2 }}
                                    whileTap={{ scale: 0.92 }}
                                    className="relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200"
                                    style={{
                                        borderColor: isActive
                                            ? theme.color
                                            : isHovered
                                              ? theme.color + "60"
                                              : "rgba(255,255,255,0.07)",
                                        backgroundColor: isActive
                                            ? theme.bg
                                            : isHovered
                                              ? theme.bg
                                              : "rgba(255,255,255,0.02)",
                                        boxShadow: isActive
                                            ? `0 0 18px ${theme.color}40`
                                            : "none",
                                    }}
                                >
                                    {/* Color swatch */}
                                    <div
                                        className="w-6 h-6 rounded-full transition-all duration-200"
                                        style={{
                                            background: `linear-gradient(135deg, ${theme.color}, ${theme.color2})`,
                                            boxShadow: isActive
                                                ? `0 0 15px ${theme.color}80`
                                                : "none",
                                            transform: isActive
                                                ? "scale(1.15)"
                                                : "scale(1)",
                                        }}
                                    />
                                    <span
                                        className="text-[9px] font-mono tracking-widest leading-tight text-center"
                                        style={{
                                            color: isActive
                                                ? theme.color
                                                : "#666",
                                        }}
                                    >
                                        {theme.label}
                                    </span>
                                    {/* Active checkmark */}
                                    <AnimatePresence>
                                        {isActive && (
                                            <motion.div
                                                initial={{
                                                    scale: 0,
                                                    opacity: 0,
                                                }}
                                                animate={{
                                                    scale: 1,
                                                    opacity: 1,
                                                }}
                                                exit={{ scale: 0, opacity: 0 }}
                                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                                                style={{
                                                    backgroundColor:
                                                        theme.color,
                                                }}
                                            >
                                                <Check className="w-2.5 h-2.5 text-black" />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            </Section>

            {/* ── Section: Push Notifications ── */}
            <Section label="PUSH NOTIFICATIONS" icon={Bell} delay={0.2}>
                <SettingRow
                    icon={push.isSubscribed ? Bell : BellOff}
                    iconBg={
                        push.isSubscribed
                            ? "rgba(0,243,255,0.12)"
                            : "rgba(100,100,100,0.1)"
                    }
                    iconColor={
                        push.isSubscribed ? "var(--color-neon-cyan)" : "#666"
                    }
                    title="Notifikasi Browser"
                    description={
                        !push.isSupported
                            ? "Browser kamu tidak mendukung push notification."
                            : push.permission === "denied"
                              ? "Izin ditolak. Reset izin di pengaturan browser."
                              : push.isSubscribed
                                ? "Aktif — kamu akan menerima alert stok kritis & laporan harian."
                                : "Aktifkan untuk menerima notifikasi bahkan saat tab ditutup."
                    }
                    badge={
                        !push.isSupported
                            ? { label: "TIDAK DIDUKUNG", color: "#666" }
                            : push.permission === "denied"
                              ? { label: "DIBLOKIR", color: "#f43f5e" }
                              : push.isSubscribed
                                ? { label: "AKTIF", color: "#00f3ff" }
                                : { label: "NONAKTIF", color: "#555" }
                    }
                >
                    <ToggleSwitch
                        enabled={push.isSubscribed}
                        onToggle={
                            push.isSubscribed
                                ? push.unsubscribe
                                : push.subscribe
                        }
                        activeColor="var(--color-neon-cyan)"
                        id="toggle-push"
                        disabled={
                            !push.isSupported ||
                            push.permission === "denied" ||
                            push.isLoading
                        }
                    />
                </SettingRow>

                {/* Tombol Test Notifikasi (hanya tampil jika sudah subscribe) */}
                {push.isSubscribed && (
                    <div className="px-5 py-3 flex items-center justify-between border-t border-white/[0.04]">
                        <div className="text-xs text-gray-600 font-mono">
                            Kirim notifikasi percobaan ke browser ini
                        </div>
                        <button
                            id="btn-test-push"
                            onClick={async () => {
                                const r = await push.sendTest();
                                if (!r.success) alert("Gagal: " + r.error);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#00f3ff]/30 text-[#00f3ff] text-[10px] font-mono hover:bg-[#00f3ff]/10 transition-all"
                        >
                            <Send className="w-3 h-3" /> Kirim Test
                        </button>
                    </div>
                )}

                {/* Error message */}
                {push.error && (
                    <p className="px-5 py-2 text-[10px] text-red-400 font-mono border-t border-white/[0.04]">
                        ⚠️ {push.error}
                    </p>
                )}
            </Section>

            {/* ── Section: Pengumuman Pekerja ── */}
            <Section
                label="PENGUMUMAN PEKERJA"
                icon={MessageSquare}
                delay={0.25}
            >
                <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-sm font-bold text-white">
                                Pesan Admin Hari Ini
                            </h4>
                            <p className="text-[10px] text-gray-500 font-mono mt-1 uppercase tracking-wider">
                                Pesan yang akan tampil di Dashboard pekerja
                                casing
                            </p>
                        </div>
                    </div>

                    <div className="relative">
                        <textarea
                            value={adminMessage}
                            onChange={(e) => setAdminMessage(e.target.value)}
                            placeholder="Ketik pesan motivasi atau instruksi di sini... (kosongkan jika tidak ada pesan)"
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-[var(--color-neon-cyan)] min-h-[100px] resize-y"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="h-6">
                            <AnimatePresence>
                                {adminMessageToast && (
                                    <motion.span
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0 }}
                                        className={`text-xs font-mono px-3 py-1 rounded flex items-center gap-1 ${
                                            adminMessageToast.type === "success"
                                                ? "text-emerald-400 bg-emerald-400/10"
                                                : "text-red-400 bg-red-400/10"
                                        }`}
                                    >
                                        {adminMessageToast.type ===
                                        "success" ? (
                                            <Check className="w-3 h-3" />
                                        ) : (
                                            <AlertTriangle className="w-3 h-3" />
                                        )}
                                        {adminMessageToast.msg}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>
                        <button
                            onClick={saveAdminMessage}
                            disabled={adminMessageSaving}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--color-neon-cyan)] text-black text-sm font-bold hover:bg-white hover:text-black transition-colors"
                        >
                            {adminMessageSaving ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            SIMPAN PESAN
                        </button>
                    </div>
                </div>
            </Section>

            {/* ── Section: Prefix Manager (Hermes Logic) ── */}
            <Section
                label="PREFIX CLASSIFICATION MANAGER"
                icon={ScanLine}
                delay={0.25}
            >
                <div className="p-5 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-sm font-bold text-white">
                                Smart Prefix Rules
                            </h4>
                            <p className="text-[10px] text-gray-500 font-mono mt-1 uppercase tracking-wider">
                                Mengatur cara Hermes mengklasifikasikan item
                                baru berdasarkan awalan kode
                            </p>
                        </div>
                        {prefixDirty && (
                            <motion.button
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                onClick={() => savePrefixRules(prefixRules)}
                                disabled={prefixSaving}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-colors shadow-[0_0_15px_rgba(34,197,94,0.4)]"
                            >
                                {prefixSaving ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                    <Save className="w-3 h-3" />
                                )}
                                SIMPAN PERUBAHAN
                            </motion.button>
                        )}
                    </div>

                    {/* Rules Table */}
                    <div className="border border-white/5 rounded-xl overflow-hidden bg-black/20">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/[0.03] text-[10px] font-mono text-gray-500 uppercase tracking-widest border-b border-white/5">
                                    <th className="px-4 py-3 font-medium">
                                        Prefix
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Dugaan Merk
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        Mode
                                    </th>
                                    <th className="px-4 py-3 font-medium text-right">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.03]">
                                {prefixLoading ? (
                                    <tr>
                                        <td
                                            colSpan="4"
                                            className="px-4 py-10 text-center text-xs font-mono text-gray-600"
                                        >
                                            <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                                            MENGUNDUH DATA DARI MAINFRAME...
                                        </td>
                                    </tr>
                                ) : prefixRules.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="4"
                                            className="px-4 py-10 text-center text-xs font-mono text-gray-600"
                                        >
                                            TIDAK ADA ATURAN PREFIX TERDAFTAR
                                        </td>
                                    </tr>
                                ) : (
                                    prefixRules.map((rule, idx) => (
                                        <tr
                                            key={idx}
                                            className="group hover:bg-white/[0.01] transition-colors"
                                        >
                                            <td className="px-4 py-3 text-xs font-mono font-bold text-[#00f3ff]">
                                                {rule.prefix}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs font-bold text-white">
                                                    {rule.brand}
                                                </div>
                                                <div className="text-[10px] text-gray-600 font-mono">
                                                    {rule.type}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() =>
                                                        togglePrefixConfidence(
                                                            idx
                                                        )
                                                    }
                                                    className="flex flex-col items-start gap-1 group/btn text-left"
                                                >
                                                    <span
                                                        className="text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded border transition-colors"
                                                        style={{
                                                            color: confidenceColors[
                                                                rule.confidence
                                                            ].color,
                                                            borderColor:
                                                                confidenceColors[
                                                                    rule
                                                                        .confidence
                                                                ].color + "40",
                                                            backgroundColor:
                                                                confidenceColors[
                                                                    rule
                                                                        .confidence
                                                                ].color + "10",
                                                        }}
                                                    >
                                                        {
                                                            confidenceColors[
                                                                rule.confidence
                                                            ].label
                                                        }
                                                    </span>
                                                    <span className="text-[8px] text-gray-600 hidden group-hover/btn:block">
                                                        {
                                                            confidenceColors[
                                                                rule.confidence
                                                            ].desc
                                                        }
                                                    </span>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() =>
                                                        removePrefixRule(idx)
                                                    }
                                                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Add New Rule Form */}
                    <div className="p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.01] space-y-4">
                        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Plus className="w-3 h-3" /> Tambah Aturan Baru
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-mono text-gray-600 uppercase ml-1">
                                    Prefix
                                </label>
                                <input
                                    type="text"
                                    placeholder="Contoh: A75C"
                                    value={newPrefix.prefix}
                                    onChange={(e) =>
                                        setNewPrefix({
                                            ...newPrefix,
                                            prefix: e.target.value,
                                        })
                                    }
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#00f3ff]/50 outline-none font-mono"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-mono text-gray-600 uppercase ml-1">
                                    Merk
                                </label>
                                <input
                                    type="text"
                                    placeholder="Panasonic"
                                    value={newPrefix.brand}
                                    onChange={(e) =>
                                        setNewPrefix({
                                            ...newPrefix,
                                            brand: e.target.value,
                                        })
                                    }
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#00f3ff]/50 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-mono text-gray-600 uppercase ml-1">
                                    Jenis
                                </label>
                                <select
                                    value={newPrefix.type}
                                    onChange={(e) =>
                                        setNewPrefix({
                                            ...newPrefix,
                                            type: e.target.value,
                                        })
                                    }
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:border-[#00f3ff]/50 outline-none"
                                >
                                    <option>Remote AC</option>
                                    <option>Remote TV</option>
                                    <option>Remote Audio</option>
                                    <option>PCB Power</option>
                                    <option>Sensor</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={addPrefixRule}
                                    disabled={
                                        !newPrefix.prefix || !newPrefix.brand
                                    }
                                    className="w-full h-[34px] flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-3.5 h-3.5" /> TAMBAH
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Toast notification inside section */}
                    <AnimatePresence>
                        {prefixToast && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className={`p-3 rounded-lg text-[10px] font-mono text-center border ${
                                    prefixToast.type === "success"
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                        : "bg-red-500/10 border-red-500/20 text-red-400"
                                }`}
                            >
                                {prefixToast.msg}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </Section>

            {/* ── Section: BOM Recipes ── */}
            <Section
                label="RESEP BOM (PANASONIC)"
                icon={SettingsIcon}
                delay={0.25}
            >
                <div className="p-5 space-y-5">
                    <p className="text-xs text-gray-400">
                        Atur pasangan Tutup Baterai untuk tipe remote Panasonic.
                        Sistem akan memotong otomatis saat pesanan dikonfirmasi.
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                        <table className="w-full text-left text-xs text-gray-300">
                            <thead className="bg-white/5 text-[10px] uppercase font-mono tracking-wider text-gray-500">
                                <tr>
                                    <th className="p-3">Tipe Remote</th>
                                    <th className="p-3">Jenis Tutup</th>
                                    <th className="p-3">Jenis Mika</th>
                                    <th className="p-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                                {recipes.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan="3"
                                            className="p-5 text-center text-gray-500"
                                        >
                                            Belum ada resep yang diatur.
                                        </td>
                                    </tr>
                                ) : (
                                    recipes.map((recipe) => (
                                        <tr
                                            key={recipe.id}
                                            className="hover:bg-white/5 transition-colors group"
                                        >
                                            <td className="p-3">
                                                {recipe.tipe_remote}
                                            </td>
                                            <td className="p-3">
                                                <span className="px-2 py-1 rounded bg-[#00f3ff]/10 text-[#00f3ff] border border-[#00f3ff]/20">
                                                    {recipe.jenis_tutup}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className="px-2 py-1 rounded bg-[#bc13fe]/10 text-[#bc13fe] border border-[#bc13fe]/20">
                                                    {recipe.jenis_mika || "-"}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button
                                                    onClick={() =>
                                                        removeRecipe(recipe.id)
                                                    }
                                                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 rounded-xl border border-dashed border-white/10 bg-white/[0.01] space-y-4">
                        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Plus className="w-3 h-3" /> Tambah Resep Baru
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-mono text-gray-600 uppercase ml-1">
                                    Tipe Remote
                                </label>
                                <input
                                    type="text"
                                    placeholder="A75C2656"
                                    value={newRecipe.tipe_remote}
                                    onChange={(e) =>
                                        setNewRecipe({
                                            ...newRecipe,
                                            tipe_remote: e.target.value,
                                        })
                                    }
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#00f3ff]/50 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-mono text-gray-600 uppercase ml-1">
                                    Jenis Tutup
                                </label>
                                <select
                                    value={newRecipe.jenis_tutup}
                                    onChange={(e) =>
                                        setNewRecipe({
                                            ...newRecipe,
                                            jenis_tutup: e.target.value,
                                        })
                                    }
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:border-[#00f3ff]/50 outline-none"
                                >
                                    <option>Tutup Baut</option>
                                    <option>Tutup Tidak Baut</option>
                                    <option>Tutup Sedang</option>
                                    <option>Tutup Besar</option>
                                    <option>Tutup Panjang</option>
                                    <option>Tutup Baut Rendam</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-mono text-gray-600 uppercase ml-1">
                                    Jenis Mika
                                </label>
                                <input
                                    type="text"
                                    placeholder="Mika A75C2656"
                                    value={newRecipe.jenis_mika}
                                    onChange={(e) =>
                                        setNewRecipe({
                                            ...newRecipe,
                                            jenis_mika: e.target.value,
                                        })
                                    }
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-[#bc13fe]/50 outline-none"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={addRecipe}
                                    disabled={!newRecipe.tipe_remote}
                                    className="w-full h-[34px] flex items-center justify-center gap-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-3.5 h-3.5" /> TAMBAH
                                </button>
                            </div>
                        </div>
                    </div>
                    <AnimatePresence>
                        {recipeToast && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className={`p-3 rounded-lg text-[10px] font-mono text-center border ${
                                    recipeToast.type === "success"
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                        : "bg-red-500/10 border-red-500/20 text-red-400"
                                }`}
                            >
                                {recipeToast.msg}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </Section>

            {/* ── Section: System Info ── */}
            <Section label="SYSTEM INFORMATION" icon={Info} delay={0.3}>
                <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                        {[
                            {
                                label: "VERSION",
                                value: "v3.1.0",
                                icon: "🏷️",
                                color: activeAccent.color,
                            },
                            {
                                label: "ENGINE",
                                value: "React + Vite",
                                icon: "⚛️",
                                color: "#38bdf8",
                            },
                            {
                                label: "BACKEND",
                                value: "Node.js + Express",
                                icon: "🖥️",
                                color: "#22c55e",
                            },
                            {
                                label: "SECURITY",
                                value: "Helmet + RateLimit",
                                icon: "🛡️",
                                color: "#a855f7",
                            },
                            {
                                label: "STYLING",
                                value: "Tailwind CSS v4",
                                icon: "🎨",
                                color: "#f59e0b",
                            },
                            {
                                label: "MOTION",
                                value: "Framer Motion",
                                icon: "✨",
                                color: "#f43f5e",
                            },
                        ].map(({ label, value, icon, color }, i) => (
                            <motion.div
                                key={label}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 + 0.3 }}
                                className="flex items-center justify-between bg-white/[0.025] hover:bg-white/[0.045] rounded-xl px-3 py-2.5 border border-white/5 transition-colors group"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-sm">{icon}</span>
                                    <span className="text-gray-600 group-hover:text-gray-500 transition-colors">
                                        {label}
                                    </span>
                                </div>
                                <span
                                    className="font-semibold"
                                    style={{ color }}
                                >
                                    {value}
                                </span>
                            </motion.div>
                        ))}
                    </div>

                    {/* Status strip */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                        className="mt-4 flex items-center gap-2 text-[10px] font-mono text-gray-600 border-t border-white/5 pt-4"
                    >
                        <ShieldCheck className="w-3 h-3 text-emerald-500" />
                        <span>
                            Semua konfigurasi tersimpan secara lokal. Tidak ada
                            data yang dikirim ke server.
                        </span>
                    </motion.div>
                </div>
            </Section>
        </div>
    );
}

/* ═══ Sub-components ═══ */

/* ── Section Wrapper ── */
function Section({ label, icon: Icon, delay = 0, children }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay }}
        >
            {/* Section header */}
            <div className="flex items-center gap-2 mb-3 px-1">
                <Icon className="w-3.5 h-3.5 text-gray-600" />
                <span className="text-[10px] font-mono tracking-[0.2em] text-gray-600 uppercase">
                    {label}
                </span>
                <div className="flex-1 h-px bg-white/5" />
            </div>

            <div className="bg-[rgba(8,8,12,0.6)] backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                {children}
            </div>
        </motion.div>
    );
}

/* ── Setting Row ── */
function SettingRow({
    icon: Icon,
    iconBg,
    iconColor,
    title,
    description,
    badge,
    children,
}) {
    return (
        <div className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors group">
            <div className="flex items-center gap-4 min-w-0">
                {/* Icon block */}
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-white/10 transition-transform group-hover:scale-105"
                    style={{ backgroundColor: iconBg }}
                >
                    <Icon
                        className="w-4.5 h-4.5"
                        style={{ color: iconColor }}
                    />
                </div>

                {/* Text */}
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white">
                            {title}
                        </h4>
                        {/* Status badge */}
                        <span
                            className="text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded-md border"
                            style={{
                                color: badge.color,
                                borderColor: badge.color + "40",
                                backgroundColor: badge.color + "15",
                            }}
                        >
                            {badge.label}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed truncate max-w-xs">
                        {description}
                    </p>
                </div>
            </div>

            {/* Control */}
            <div className="shrink-0">{children}</div>
        </div>
    );
}

/* ── Toggle Switch ── */
function ToggleSwitch({ enabled, onToggle, activeColor, id }) {
    return (
        <button
            id={id}
            onClick={onToggle}
            aria-pressed={enabled}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 shrink-0 border ${
                enabled ? "border-transparent" : "bg-white/5 border-white/10"
            }`}
            style={
                enabled
                    ? {
                          backgroundColor: activeColor + "30",
                          borderColor: activeColor + "50",
                      }
                    : {}
            }
        >
            <motion.div
                animate={{ x: enabled ? 26 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-1 w-5 h-5 rounded-full"
                style={{
                    backgroundColor: enabled ? activeColor : "#555",
                    boxShadow: enabled ? `0 0 10px ${activeColor}` : "none",
                }}
            />
        </button>
    );
}
