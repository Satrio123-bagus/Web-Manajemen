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
            cyan:   { primary: '#00f3ff', secondary: '#bc13fe' },
            green:  { primary: '#22c55e', secondary: '#10b981' },
            purple: { primary: '#a855f7', secondary: '#7c3aed' },
            amber:  { primary: '#f59e0b', secondary: '#d97706' },
            rose:   { primary: '#f43f5e', secondary: '#e11d48' },
            sky:    { primary: '#38bdf8', secondary: '#0ea5e9' },
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
