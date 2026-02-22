import { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Palette, Volume2, VolumeX, Zap, Monitor, Info } from 'lucide-react';

/* ── Load from localStorage ── */
function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('i3c_settings') || '{}');
        return {
            lowGraphics: saved.lowGraphics ?? false,
            soundEnabled: saved.soundEnabled ?? true,
            accentTheme: saved.accentTheme ?? 'cyan', // 'cyan' | 'green'
        };
    } catch {
        return { lowGraphics: false, soundEnabled: true, accentTheme: 'cyan' };
    }
}

export default function Settings() {
    const [settings, setSettings] = useState(loadSettings);

    /* Persist on change */
    useEffect(() => {
        localStorage.setItem('i3c_settings', JSON.stringify(settings));
    }, [settings]);

    const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    const setAccent = (theme) => setSettings(prev => ({ ...prev, accentTheme: theme }));

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <SettingsIcon className="w-6 h-6 text-[var(--color-neon-cyan)]" />
                    System Settings
                </h2>
                <p className="text-xs font-mono text-gray-600 mt-1">Configuration persisted to localStorage</p>
            </div>

            {/* Settings Cards */}
            <div className="space-y-4">
                {/* Low Graphics Mode */}
                <SettingCard
                    icon={Monitor}
                    title="Low Graphics Mode"
                    description="Disable complex animations and particle effects for better performance on older hardware."
                    accentColor="var(--color-neon-cyan)"
                >
                    <ToggleSwitch
                        enabled={settings.lowGraphics}
                        onToggle={() => toggle('lowGraphics')}
                        activeColor="var(--color-neon-cyan)"
                    />
                </SettingCard>

                {/* Sound Effects */}
                <SettingCard
                    icon={settings.soundEnabled ? Volume2 : VolumeX}
                    title="Sound Effects"
                    description="Enable or disable UI sound effects and notification audio cues."
                    accentColor="var(--color-neon-purple)"
                >
                    <ToggleSwitch
                        enabled={settings.soundEnabled}
                        onToggle={() => toggle('soundEnabled')}
                        activeColor="var(--color-neon-purple)"
                    />
                </SettingCard>

                {/* Theme Accent */}
                <SettingCard
                    icon={Palette}
                    title="Theme Accent"
                    description="Choose the primary accent color for the interface."
                    accentColor="#facc15"
                >
                    <div className="flex gap-3">
                        <AccentButton
                            label="CYAN"
                            color="#00f3ff"
                            active={settings.accentTheme === 'cyan'}
                            onClick={() => setAccent('cyan')}
                        />
                        <AccentButton
                            label="GREEN"
                            color="#22c55e"
                            active={settings.accentTheme === 'green'}
                            onClick={() => setAccent('green')}
                        />
                    </div>
                </SettingCard>
            </div>

            {/* System Info */}
            <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="bg-[rgba(8,8,12,0.6)] backdrop-blur-xl border border-white/5 rounded-2xl p-6"
            >
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                    <Info className="w-4 h-4 text-gray-500" />
                    System Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    {[
                        ['VERSION', 'v3.0.0'],
                        ['ENGINE', 'React + Vite'],
                        ['BACKEND', 'Node.js + Express'],
                        ['SECURITY', 'Helmet + Rate-Limit'],
                        ['STYLING', 'Tailwind CSS v4'],
                        ['MOTION', 'Framer Motion'],
                    ].map(([label, value]) => (
                        <div key={label} className="flex justify-between bg-white/[0.02] rounded-lg px-3 py-2">
                            <span className="text-gray-600">{label}</span>
                            <span className="text-gray-300">{value}</span>
                        </div>
                    ))}
                </div>
            </motion.div>
        </div>
    );
}

/* ═══ Sub-components ═══ */

function SettingCard({ icon: Icon, title, description, accentColor, children }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[rgba(8,8,12,0.6)] backdrop-blur-xl border border-white/5 rounded-2xl p-6 flex items-center justify-between gap-6 group hover:border-white/10 transition-colors"
        >
            <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 shrink-0">
                    <Icon className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-white">{title}</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-sm">{description}</p>
                </div>
            </div>
            {children}
        </motion.div>
    );
}

function ToggleSwitch({ enabled, onToggle, activeColor }) {
    return (
        <button
            onClick={onToggle}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 shrink-0 border ${enabled
                    ? 'border-transparent'
                    : 'bg-white/5 border-white/10'
                }`}
            style={enabled ? { backgroundColor: activeColor + '30', borderColor: activeColor + '50' } : {}}
        >
            <motion.div
                animate={{ x: enabled ? 26 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-5 h-5 rounded-full"
                style={{ backgroundColor: enabled ? activeColor : '#555', boxShadow: enabled ? `0 0 10px ${activeColor}` : 'none' }}
            />
        </button>
    );
}

function AccentButton({ label, color, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-lg text-[10px] font-mono tracking-widest border transition-all
        ${active
                    ? 'text-black font-bold shadow-[0_0_15px_currentColor]'
                    : 'text-gray-500 border-white/10 bg-white/5 hover:border-white/20'
                }`}
            style={active ? { backgroundColor: color, borderColor: color, color: '#000' } : {}}
        >
            {label}
        </button>
    );
}
