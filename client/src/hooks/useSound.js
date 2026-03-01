import { useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';

// Simple sound utility using Web Audio API for synthetic UI sounds
export function useSound() {
    const { settings } = useSettings();

    const playSound = useCallback((type) => {
        if (!settings.soundEnabled) return;

        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            const now = ctx.currentTime;

            // Synthesis parameters based on sound 'type'
            switch (type) {
                case 'hover':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(400, now);
                    osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
                    gainNode.gain.setValueAtTime(0.05, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                    osc.start(now);
                    osc.stop(now + 0.1);
                    break;
                case 'click':
                    osc.type = 'square';
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
                    gainNode.gain.setValueAtTime(0.1, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                    osc.start(now);
                    osc.stop(now + 0.05);
                    break;
                case 'success':
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(400, now);
                    osc.frequency.setValueAtTime(600, now + 0.1);
                    osc.frequency.setValueAtTime(800, now + 0.2);
                    gainNode.gain.setValueAtTime(0.1, now);
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.4);
                    osc.start(now);
                    osc.stop(now + 0.4);
                    break;
                case 'error':
                    osc.type = 'sawtooth';
                    osc.frequency.setValueAtTime(200, now);
                    osc.frequency.linearRampToValueAtTime(100, now + 0.3);
                    gainNode.gain.setValueAtTime(0.2, now);
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
                    osc.start(now);
                    osc.stop(now + 0.3);
                    break;
                case 'bell': // for notifications
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(880, now); // A5
                    gainNode.gain.setValueAtTime(0.15, now);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                    osc.start(now);
                    osc.stop(now + 0.5);
                    break;
                default:
                    // Default beep
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(440, now);
                    gainNode.gain.setValueAtTime(0.1, now);
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
                    osc.start(now);
                    osc.stop(now + 0.1);
            }
        } catch (e) {
            console.warn('Audio synthesis failed or blocked by browser', e);
        }
    }, [settings.soundEnabled]);

    return { playSound };
}
