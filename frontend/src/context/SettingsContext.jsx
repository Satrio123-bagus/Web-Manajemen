import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(() => {
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
    });

    // Apply global CSS variables based on theme
    useEffect(() => {
        const root = document.documentElement;
        // Map setiap pilihan tema ke pasangan warna primer & sekunder
        const themeMap = {
            cyan:      { primary: '#00f3ff', secondary: '#bc13fe' }, // Default
            synthwave: { primary: '#ec4899', secondary: '#f97316' }, // Hot Pink & Orange
            matrix:    { primary: '#22c55e', secondary: '#14b8a6' }, // Neon Green & Teal
            imperial:  { primary: '#fbbf24', secondary: '#ef4444' }, // Cyber Gold & Crimson
            void:      { primary: '#3b82f6', secondary: '#6366f1' }, // Royal Blue & Indigo
            sith:      { primary: '#dc2626', secondary: '#ea580c' }, // Blood Red & Fiery Orange
        };
        const chosen = themeMap[settings.accentTheme] ?? themeMap.cyan;
        root.style.setProperty('--color-neon-cyan',   chosen.primary);
        root.style.setProperty('--color-neon-purple',  chosen.secondary);

        // Handle low graphics mode by toggling a class on the body
        if (settings.lowGraphics) {
            document.body.classList.add('low-graphics');
        } else {
            document.body.classList.remove('low-graphics');
        }

        localStorage.setItem('i3c_settings', JSON.stringify(settings));
    }, [settings]);

    const toggleSetting = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    const setSetting = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

    return (
        <SettingsContext.Provider value={{ settings, toggleSetting, setSetting }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    return useContext(SettingsContext);
}
