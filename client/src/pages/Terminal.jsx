import { useState, useRef, useEffect, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';

const BOOT_LINES = [
    '[BOOT] INSERT3COINS Terminal v3.0.0',
    '[BOOT] Establishing secure connection to backend...',
    '[BOOT] Encryption: AES-256 ✓ | TLS 1.3 ✓',
    '[BOOT] Connection established. Type "help" for commands.',
    '',
];

export default function Terminal() {
    const [lines, setLines] = useState([]);
    const [input, setInput] = useState('');
    const [history, setHistory] = useState([]);
    const [histIdx, setHistIdx] = useState(-1);
    const [isProcessing, setIsProcessing] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const booted = useRef(false);

    /* Boot sequence */
    useEffect(() => {
        if (booted.current) return;
        booted.current = true;
        BOOT_LINES.forEach((line, i) => {
            setTimeout(() => {
                setLines(prev => [...prev, { type: 'system', text: line }]);
            }, i * 200);
        });
    }, []);

    /* Auto-scroll */
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [lines]);

    /* Focus input on click anywhere */
    const focusInput = useCallback(() => inputRef.current?.focus(), []);

    /* Execute command */
    const execute = async (cmd) => {
        const trimmed = cmd.trim();
        if (!trimmed) return;

        // Add command to display
        setLines(prev => [...prev, { type: 'input', text: `> ${trimmed}` }]);
        setHistory(prev => [trimmed, ...prev].slice(0, 50));
        setHistIdx(-1);
        setInput('');

        // Handle client-side clear
        if (trimmed.toLowerCase() === 'clear') {
            setLines([{ type: 'system', text: '[SYSTEM] Terminal cleared.' }]);
            return;
        }

        setIsProcessing(true);
        try {
            const res = await fetch('/api/terminal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: trimmed }),
            });
            const data = await res.json();

            if (data.output) {
                data.output.forEach((line, i) => {
                    setTimeout(() => {
                        setLines(prev => [...prev, { type: 'output', text: line }]);
                    }, i * 30);
                });
                // Add empty line after output
                setTimeout(() => {
                    setLines(prev => [...prev, { type: 'output', text: '' }]);
                }, data.output.length * 30);
            } else if (data.error) {
                setLines(prev => [...prev, { type: 'error', text: `[ERROR] ${data.error}` }]);
            }
        } catch {
            setLines(prev => [...prev, { type: 'error', text: '[ERROR] Connection to backend lost.' }]);
        } finally {
            setIsProcessing(false);
        }
    };

    /* Keyboard handling */
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            execute(input);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (history.length > 0) {
                const next = Math.min(histIdx + 1, history.length - 1);
                setHistIdx(next);
                setInput(history[next]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (histIdx > 0) {
                const next = histIdx - 1;
                setHistIdx(next);
                setInput(history[next]);
            } else {
                setHistIdx(-1);
                setInput('');
            }
        }
    };

    const lineColor = (type) => {
        switch (type) {
            case 'input': return 'text-[var(--color-neon-cyan)]';
            case 'error': return 'text-red-400';
            case 'system': return 'text-[var(--color-neon-purple)]';
            default: return 'text-gray-300';
        }
    };

    return (
        <div className="max-w-[1400px] mx-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative bg-black border border-[var(--color-neon-cyan)]/20 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,243,255,0.08)] min-h-[calc(100vh-10rem)]"
                onClick={focusInput}
            >
                {/* CRT scanline overlay */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%)] bg-[length:100%_2px] opacity-30 z-20" />

                {/* Header bar */}
                <div className="sticky top-0 z-30 flex items-center gap-3 px-5 py-3 bg-black/90 backdrop-blur border-b border-[var(--color-neon-cyan)]/10">
                    <div className="flex gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-500/80" />
                        <span className="w-3 h-3 rounded-full bg-amber-400/80" />
                        <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
                    </div>
                    <span className="text-[10px] font-mono tracking-widest text-gray-600 flex-1 text-center">
                        INSERT3COINS_TERMINAL — {isProcessing ? 'PROCESSING...' : 'READY'}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'} shadow-[0_0_6px_currentColor]`} />
                </div>

                {/* Terminal output */}
                <div className="p-5 font-mono text-sm space-y-0.5 min-h-[400px] relative z-10">
                    {lines.map((line, i) => (
                        <div key={i} className={`${lineColor(line.type)} whitespace-pre-wrap leading-relaxed`}>
                            {line.text}
                        </div>
                    ))}

                    {/* Input line */}
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[var(--color-neon-cyan)] shrink-0">&gt;</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isProcessing}
                            className="flex-1 bg-transparent border-none outline-none text-[var(--color-neon-cyan)] font-mono text-sm caret-[var(--color-neon-cyan)]"
                            autoFocus
                            spellCheck={false}
                            autoComplete="off"
                        />
                        {/* Blinking cursor */}
                        {!input && (
                            <span className="text-[var(--color-neon-cyan)] animate-[flicker_1s_infinite]">█</span>
                        )}
                    </div>
                    <div ref={bottomRef} />
                </div>
            </motion.div>
        </div>
    );
}
