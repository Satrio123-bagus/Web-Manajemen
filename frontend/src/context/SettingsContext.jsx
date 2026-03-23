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
        if (settings.accentTheme === 'green') {
            root.style.setProperty('--color-neon-cyan', '#22c55e'); // Green accent
            root.style.setProperty('--color-neon-purple', '#10b981'); // Emerald secondary
        } else {
            root.style.setProperty('--color-neon-cyan', '#00f3ff'); // Default cyan
            root.style.setProperty('--color-neon-purple', '#bc13fe'); // Default purple
        }

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
