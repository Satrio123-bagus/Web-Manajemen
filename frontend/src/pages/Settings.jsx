import { useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
    Settings as SettingsIcon, Palette, Volume2, VolumeX,
    Monitor, Info, Cpu, ShieldCheck, Zap, Check, Bell, BellOff, Send
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { usePushNotification } from '../hooks/usePushNotification';

/* ─── Accent color palette ─── */
const ACCENT_THEMES = [
    { id: 'cyan',   label: 'CYBER CYAN',  color: '#00f3ff', bg: 'rgba(0,243,255,0.08)'   },
    { id: 'green',  label: 'MATRIX GRN',  color: '#22c55e', bg: 'rgba(34,197,94,0.08)'   },
    { id: 'purple', label: 'NEON VIOLET', color: '#a855f7', bg: 'rgba(168,85,247,0.08)'  },
    { id: 'amber',  label: 'GOLD RUSH',   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
    { id: 'rose',   label: 'ROSE WAVE',   color: '#f43f5e', bg: 'rgba(244,63,94,0.08)'   },
    { id: 'sky',    label: 'SKY BLUE',    color: '#38bdf8', bg: 'rgba(56,189,248,0.08)'  },
];

export default function Settings() {
    const { settings, toggleSetting, setSetting } = useSettings();
    const [hoveredAccent, setHoveredAccent] = useState(null);
    const push = usePushNotification();

    const toggle    = (key)         => toggleSetting(key);
    const setAccent = (theme)       => setSetting('accentTheme', theme);

    const activeAccent = ACCENT_THEMES.find(t => t.id === settings.accentTheme) ?? ACCENT_THEMES[0];

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-10">

            {/* ── Page Header ── */}
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 rounded-xl border border-white/10 bg-white/5"
                        style={{ boxShadow: `0 0 18px ${activeAccent.color}33` }}>
                        <SettingsIcon className="w-5 h-5" style={{ color: activeAccent.color }} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">System Settings</h2>
                        <p className="text-[11px] font-mono text-gray-600 mt-0.5">Configuration persisted to localStorage</p>
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
                    badge={settings.lowGraphics ? { label: 'AKTIF', color: '#00f3ff' } : { label: 'NONAKTIF', color: '#555' }}
                >
                    <ToggleSwitch
                        enabled={settings.lowGraphics}
                        onToggle={() => toggle('lowGraphics')}
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
                    badge={settings.soundEnabled ? { label: 'ON', color: '#bc13fe' } : { label: 'OFF', color: '#555' }}
                >
                    <ToggleSwitch
                        enabled={settings.soundEnabled}
                        onToggle={() => toggle('soundEnabled')}
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
                            style={{ color: activeAccent.color, backgroundColor: activeAccent.bg, border: `1px solid ${activeAccent.color}40` }}
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
                                    onMouseEnter={() => setHoveredAccent(theme.id)}
                                    onMouseLeave={() => setHoveredAccent(null)}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.04 + 0.2 }}
                                    whileTap={{ scale: 0.92 }}
                                    className="relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200"
                                    style={{
                                        borderColor: isActive ? theme.color : (isHovered ? theme.color + '60' : 'rgba(255,255,255,0.07)'),
                                        backgroundColor: isActive ? theme.bg : (isHovered ? theme.bg : 'rgba(255,255,255,0.02)'),
                                        boxShadow: isActive ? `0 0 18px ${theme.color}40` : 'none',
                                    }}
                                >
                                    {/* Color swatch */}
                                    <div
                                        className="w-6 h-6 rounded-full transition-all duration-200"
                                        style={{
                                            backgroundColor: theme.color,
                                            boxShadow: isActive ? `0 0 12px ${theme.color}` : 'none',
                                            transform: isActive ? 'scale(1.15)' : 'scale(1)',
                                        }}
                                    />
                                    <span
                                        className="text-[9px] font-mono tracking-widest leading-tight text-center"
                                        style={{ color: isActive ? theme.color : '#666' }}
                                    >
                                        {theme.label}
                                    </span>
                                    {/* Active checkmark */}
                                    <AnimatePresence>
                                        {isActive && (
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0, opacity: 0 }}
                                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                                                style={{ backgroundColor: theme.color }}
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
                    iconBg={push.isSubscribed ? 'rgba(0,243,255,0.12)' : 'rgba(100,100,100,0.1)'}
                    iconColor={push.isSubscribed ? 'var(--color-neon-cyan)' : '#666'}
                    title="Notifikasi Browser"
                    description={
                        !push.isSupported
                            ? 'Browser kamu tidak mendukung push notification.'
                            : push.permission === 'denied'
                                ? 'Izin ditolak. Reset izin di pengaturan browser.'
                                : push.isSubscribed
                                    ? 'Aktif — kamu akan menerima alert stok kritis & laporan harian.'
                                    : 'Aktifkan untuk menerima notifikasi bahkan saat tab ditutup.'
                    }
                    badge={
                        !push.isSupported
                            ? { label: 'TIDAK DIDUKUNG', color: '#666' }
                            : push.permission === 'denied'
                                ? { label: 'DIBLOKIR', color: '#f43f5e' }
                                : push.isSubscribed
                                    ? { label: 'AKTIF', color: '#00f3ff' }
                                    : { label: 'NONAKTIF', color: '#555' }
                    }
                >
                    <ToggleSwitch
                        enabled={push.isSubscribed}
                        onToggle={push.isSubscribed ? push.unsubscribe : push.subscribe}
                        activeColor="var(--color-neon-cyan)"
                        id="toggle-push"
                        disabled={!push.isSupported || push.permission === 'denied' || push.isLoading}
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
                                if (!r.success) alert('Gagal: ' + r.error);
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

            {/* ── Section: System Info ── */}
            <Section label="SYSTEM INFORMATION" icon={Info} delay={0.25}>
                <div className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                        {[
                            { label: 'VERSION',  value: 'v3.1.0',             icon: '🏷️',  color: activeAccent.color },
                            { label: 'ENGINE',   value: 'React + Vite',       icon: '⚛️',  color: '#38bdf8' },
                            { label: 'BACKEND',  value: 'Node.js + Express',  icon: '🖥️',  color: '#22c55e' },
                            { label: 'SECURITY', value: 'Helmet + RateLimit', icon: '🛡️',  color: '#a855f7' },
                            { label: 'STYLING',  value: 'Tailwind CSS v4',    icon: '🎨',  color: '#f59e0b' },
                            { label: 'MOTION',   value: 'Framer Motion',      icon: '✨',  color: '#f43f5e' },
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
                                    <span className="text-gray-600 group-hover:text-gray-500 transition-colors">{label}</span>
                                </div>
                                <span className="font-semibold" style={{ color }}>{value}</span>
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
                        <span>Semua konfigurasi tersimpan secara lokal. Tidak ada data yang dikirim ke server.</span>
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
                <span className="text-[10px] font-mono tracking-[0.2em] text-gray-600 uppercase">{label}</span>
                <div className="flex-1 h-px bg-white/5" />
            </div>

            <div className="bg-[rgba(8,8,12,0.6)] backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                {children}
            </div>
        </motion.div>
    );
}

/* ── Setting Row ── */
function SettingRow({ icon: Icon, iconBg, iconColor, title, description, badge, children }) {
    return (
        <div className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors group">
            <div className="flex items-center gap-4 min-w-0">
                {/* Icon block */}
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-white/10 transition-transform group-hover:scale-105"
                    style={{ backgroundColor: iconBg }}
                >
                    <Icon className="w-4.5 h-4.5" style={{ color: iconColor }} />
                </div>

                {/* Text */}
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white">{title}</h4>
                        {/* Status badge */}
                        <span
                            className="text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded-md border"
                            style={{
                                color: badge.color,
                                borderColor: badge.color + '40',
                                backgroundColor: badge.color + '15',
                            }}
                        >
                            {badge.label}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed truncate max-w-xs">{description}</p>
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
                enabled ? 'border-transparent' : 'bg-white/5 border-white/10'
            }`}
            style={enabled ? { backgroundColor: activeColor + '30', borderColor: activeColor + '50' } : {}}
        >
            <motion.div
                animate={{ x: enabled ? 26 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-5 h-5 rounded-full"
                style={{
                    backgroundColor: enabled ? activeColor : '#555',
                    boxShadow: enabled ? `0 0 10px ${activeColor}` : 'none',
                }}
            />
        </button>
    );
}
