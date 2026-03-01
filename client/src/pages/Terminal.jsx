import { useState, useRef, useEffect, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Mic, MicOff, Trash2, Volume2, VolumeX } from 'lucide-react';

const getTimestamp = () => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = String(now.getFullYear()).slice(-2);
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `[${d}/${m}/${y} ${time}]`;
};

const BOOT_LINES = [
    `${getTimestamp()} [BOOT] INSERT3COINS Terminal v3.1.0`,
    `${getTimestamp()} [BOOT] Menghubungkan ke backend...`,
    `${getTimestamp()} [BOOT] Enkripsi: AES-256 ✓ | TLS 1.3 ✓`,
    `${getTimestamp()} [BOOT] CORTEX AI: Analitik ✓ | Multi-Aksi ✓ | Memori ✓`,
    `${getTimestamp()} [BOOT] Input Suara: ${typeof webkitSpeechRecognition !== 'undefined' || typeof SpeechRecognition !== 'undefined' ? 'AKTIF ✓' : 'TIDAK_TERSEDIA'}`,
    `${getTimestamp()} [BOOT] Koneksi berhasil. Ketik "help" untuk daftar perintah.`,
    '',
];

// Generate a unique session ID for conversation memory
const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default function Terminal() {
    const [lines, setLines] = useState([]);
    const [input, setInput] = useState('');
    const [history, setHistory] = useState([]);
    const [histIdx, setHistIdx] = useState(-1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [ttsEnabled, setTtsEnabled] = useState(true);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const booted = useRef(false);
    const sessionId = useRef(generateSessionId());
    const recognitionRef = useRef(null);
    const executeRef = useRef(null);

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

    /* ── Text-to-Speech (Cortex speaks back) ── */
    const speakResponse = useCallback((text) => {
        if (!ttsEnabled || !window.speechSynthesis) return;

        // Clean text: remove tags like [CORTEX], [STATUS], timestamps, etc.
        const cleaned = text
            .replace(/\[.*?\]/g, '')
            .replace(/<<<.*?>>>/g, '')
            .replace(/\/\/.*$/gm, '')
            .replace(/[─═|•⚠]/g, '')
            .replace(/Rp([\d.,]+)/g, '$1 rupiah')
            .replace(/\s+/g, ' ')
            .trim();

        if (!cleaned || cleaned.length < 3) return;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(cleaned);
        utterance.lang = 'id-ID';

        // Pick the smoothest available voice (prefer Google/premium voices)
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v =>
            v.lang.startsWith('id') && v.name.toLowerCase().includes('google')
        ) || voices.find(v =>
            v.lang.startsWith('id') && (v.name.includes('Female') || v.name.includes('Natural'))
        ) || voices.find(v => v.lang.startsWith('id'));

        if (preferred) utterance.voice = preferred;

        utterance.rate = 1.0;   // natural speed (not rushed)
        utterance.pitch = 1.0;  // natural pitch
        utterance.volume = 1.0;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
            setIsSpeaking(false);
            // Auto-listen after Cortex finishes speaking (hands-free mode)
            if (recognitionRef.current && ttsEnabled) {
                setTimeout(() => {
                    try {
                        recognitionRef.current.start();
                        setIsListening(true);
                    } catch { /* already listening */ }
                }, 500);
            }
        };
        utterance.onerror = () => setIsSpeaking(false);

        window.speechSynthesis.speak(utterance);
    }, [ttsEnabled]);

    /* ── Voice Input Setup ── */
    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) return;

        const recognition = new SpeechRecognitionAPI();
        recognition.lang = 'id-ID'; // Indonesian language
        recognition.interimResults = false;
        recognition.continuous = false;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInput(transcript);
            setIsListening(false);
            // Auto-execute the voice command via ref (avoids stale closure)
            setTimeout(() => executeRef.current?.(transcript), 300);
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
    }, []);

    const toggleVoice = () => {
        if (!recognitionRef.current) {
            setLines(prev => [...prev, {
                type: 'error',
                text: `${getTimestamp()} [ERROR] Voice input not supported in this browser.`
            }]);
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            recognitionRef.current.start();
            setIsListening(true);
            setLines(prev => [...prev, {
                type: 'system',
                text: `${getTimestamp()} [VOICE] Mendengarkan... bicara sekarang.`
            }]);
        }
    };

    /* Clear conversation memory */
    const clearMemory = async () => {
        try {
            await fetch('/api/terminal/history', {
                method: 'DELETE',
                headers: { 'X-Session-ID': sessionId.current },
            });
            sessionId.current = generateSessionId();
            setLines(prev => [...prev, {
                type: 'system',
                text: `${getTimestamp()} [SYSTEM] Memori percakapan dihapus. Sesi baru dimulai.`
            }]);
        } catch {
            setLines(prev => [...prev, {
                type: 'error',
                text: `${getTimestamp()} [ERROR] Gagal menghapus memori.`
            }]);
        }
    };

    /* Execute command */
    const execute = async (cmd) => {
        const trimmed = cmd.trim();
        if (!trimmed) return;

        // Add command to display
        setLines(prev => [...prev, { type: 'input', text: `${getTimestamp()} > ${trimmed}` }]);
        setHistory(prev => [trimmed, ...prev].slice(0, 50));
        setHistIdx(-1);
        setInput('');

        // Handle client-side clear
        if (trimmed.toLowerCase() === 'clear') {
            setLines([{ type: 'system', text: `${getTimestamp()} [SYSTEM] Terminal dibersihkan.` }]);
            return;
        }

        // Handle 'selesai' — end hands-free voice conversation
        const stopWords = ['selesai', 'stop', 'berhenti', 'cukup', 'sudah'];
        if (stopWords.includes(trimmed.toLowerCase())) {
            window.speechSynthesis?.cancel();
            recognitionRef.current?.stop();
            setIsListening(false);
            setIsSpeaking(false);

            const goodbye = 'CORTEX menonaktifkan mode suara. Sampai jumpa, operator.';
            setLines(prev => [...prev, { type: 'system', text: `${getTimestamp()} [CORTEX] ${goodbye}` }]);

            // Speak the farewell WITHOUT auto-listen after
            if (ttsEnabled && window.speechSynthesis) {
                const utterance = new SpeechSynthesisUtterance(goodbye);
                utterance.lang = 'id-ID';
                utterance.rate = 1.1;
                utterance.pitch = 0.9;
                window.speechSynthesis.speak(utterance);
            }
            return;
        }

        setIsProcessing(true);
        try {
            const res = await fetch('/api/terminal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': sessionId.current,
                },
                body: JSON.stringify({ command: trimmed }),
            });
            const data = await res.json();

            if (data.output) {
                const ts = data.timestamp ? `[${new Date(data.timestamp).toLocaleString('en-GB')}]` : getTimestamp();

                data.output.forEach((line, i) => {
                    setTimeout(() => {
                        setLines(prev => [...prev, { type: 'output', text: `${ts} ${line}` }]);
                    }, i * 30);
                });
                setTimeout(() => {
                    setLines(prev => [...prev, { type: 'output', text: '' }]);
                }, data.output.length * 30);

                // Cortex speaks the response
                const spokenText = data.output.filter(l => l.trim()).join('. ');
                speakResponse(spokenText);
            } else if (data.error) {
                setLines(prev => [...prev, { type: 'error', text: `${getTimestamp()} [ERROR] ${data.error}` }]);
                speakResponse('Error. ' + data.error);
            }
        } catch {
            setLines(prev => [...prev, { type: 'error', text: `${getTimestamp()} [ERROR] Koneksi ke backend terputus.` }]);
        } finally {
            setIsProcessing(false);
        }
    };

    // Keep executeRef synced so voice input can always call the latest version
    executeRef.current = execute;
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
                        INSERT3COINS_TERMINAL — {isProcessing ? 'PROCESSING...' : isSpeaking ? 'SPEAKING...' : isListening ? 'LISTENING...' : 'READY'}
                    </span>

                    {/* TTS Toggle */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setTtsEnabled(!ttsEnabled);
                            if (ttsEnabled) window.speechSynthesis?.cancel();
                        }}
                        title={ttsEnabled ? 'Disable voice response' : 'Enable voice response'}
                        className={`p-1.5 rounded-lg transition-all ${ttsEnabled
                            ? 'text-[var(--color-neon-cyan)] bg-[var(--color-neon-cyan)]/10 border border-[var(--color-neon-cyan)]/30'
                            : 'text-gray-600 hover:text-gray-400'
                            }`}
                    >
                        {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    </button>

                    {/* Clear Memory button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); clearMemory(); }}
                        title="Clear conversation memory"
                        className="p-1.5 rounded-lg text-gray-600 hover:text-amber-400 hover:bg-amber-400/10 transition-all"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-amber-400 animate-pulse' : isListening ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'} shadow-[0_0_6px_currentColor]`} />
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

                        {/* Voice input button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleVoice(); }}
                            disabled={isProcessing}
                            className={`p-2 rounded-lg transition-all ${isListening
                                ? 'text-red-400 bg-red-500/10 border border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.3)] animate-pulse'
                                : 'text-gray-600 hover:text-[var(--color-neon-cyan)] hover:bg-[var(--color-neon-cyan)]/10'
                                }`}
                            title={isListening ? 'Stop listening' : 'Voice input (Indonesian)'}
                        >
                            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>

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
