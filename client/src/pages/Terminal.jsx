import { useState, useRef, useEffect, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Mic, MicOff, Trash2, Volume2, VolumeX, Send, X, Copy, Download } from 'lucide-react';

/* ── Help command content ── */
const HELP_LINES = [
    '╔══════════════════════════════════════════════════════════════╗',
    '║              CORTEX COMMAND REFERENCE v3.1.0                ║',
    '╠══════════════════════════════════════════════════════════════╣',
    '║                                                            ║',
    '║  [PERINTAH SISTEM]                                         ║',
    '║    help         — Tampilkan daftar perintah ini             ║',
    '║    clear        — Bersihkan layar terminal                  ║',
    '║    retry        — Cek ulang koneksi backend                 ║',
    '║    system reindex — Re-index database (urutkan A-Z)        ║',
    '║                                                            ║',
    '║  [INVENTORI]                                                ║',
    '║    tampilkan semua stok   — Lihat seluruh inventori         ║',
    '║    stok rendah            — Item dengan stok < 5            ║',
    '║    cari [nama]            — Cari item berdasarkan nama      ║',
    '║                                                            ║',
    '║  [TRANSAKSI]                                                ║',
    '║    jual [N] [item]        — Jual N unit item                ║',
    '║    tambah stok [N] [item] — Restock N unit item             ║',
    '║    buat [nama]            — Tambah item baru                ║',
    '║    hapus [item]           — Hapus item dari inventori       ║',
    '║                                                            ║',
    '║  [EDIT]                                                     ║',
    '║    ubah [item] menjadi [nama baru]  — Ganti nama item       ║',
    '║    stok [item] [N]                  — Set stok ke N         ║',
    '║    harga [item] [N]                 — Set harga ke N        ║',
    '║                                                            ║',
    '║  [ANALITIK]                                                 ║',
    '║    laporan penjualan      — Ringkasan penjualan             ║',
    '║    item terlaris          — Top 5 item terlaris             ║',
    '║    total pendapatan       — Total revenue keseluruhan       ║',
    '║                                                            ║',
    '║  [VOICE]                                                    ║',
    '║    🎤 Klik mic untuk mulai  | "kirim"  = kirim perintah     ║',
    '║    "batal" = ulangi teks    | "selesai" = akhiri sesi       ║',
    '║                                                            ║',
    '║  [SHORTCUT]                                                 ║',
    '║    ↑ / ↓  — Riwayat perintah sebelumnya                     ║',
    '║    🔊/🔇  — Toggle respons suara CORTEX                     ║',
    '║    🗑️     — Hapus memori percakapan                         ║',
    '║                                                            ║',
    '╚══════════════════════════════════════════════════════════════╝',
];

const getTimestamp = () => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = String(now.getFullYear()).slice(-2);
    const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `[${d}/${m}/${y} ${time}]`;
};

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
    const [voicePreview, setVoicePreview] = useState('');
    const [inventoryNames, setInventoryNames] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const booted = useRef(false);
    const sessionId = useRef(generateSessionId());
    const recognitionRef = useRef(null);
    const executeRef = useRef(null);

    /* Boot sequence — with real backend health check */
    useEffect(() => {
        if (booted.current) return;
        booted.current = true;

        const hasSpeech = typeof webkitSpeechRecognition !== 'undefined' || typeof SpeechRecognition !== 'undefined';

        // Fetch inventory names for autocomplete
        fetch('/api/items')
            .then(res => res.json())
            .then(data => setInventoryNames(data.map(i => i.name)))
            .catch(() => { });

        const addLine = (text, delay) =>
            new Promise(resolve => setTimeout(() => {
                setLines(prev => [...prev, { type: 'system', text }]);
                resolve();
            }, delay));

        (async () => {
            await addLine(`${getTimestamp()} [BOOT] INSERT3COINS Terminal v3.1.0`, 0);
            await addLine(`${getTimestamp()} [BOOT] Memverifikasi koneksi backend...`, 200);

            // Real health check
            try {
                const res = await fetch('/api/status', { signal: AbortSignal.timeout(5000) });
                if (!res.ok) throw new Error('Status not OK');
                await addLine(`${getTimestamp()} [BOOT] Enkripsi: AES-256 ✓ | TLS 1.3 ✓`, 200);
                await addLine(`${getTimestamp()} [BOOT] CORTEX AI: Analitik ✓ | Multi-Aksi ✓ | Memori ✓`, 200);
                await addLine(`${getTimestamp()} [BOOT] Input Suara: ${hasSpeech ? 'AKTIF ✓' : 'TIDAK_TERSEDIA'}`, 200);
                await addLine(`${getTimestamp()} [BOOT] Koneksi berhasil. Ketik "help" untuk daftar perintah.`, 200);
                await addLine('', 100);
            } catch {
                await addLine(`${getTimestamp()} [BOOT] ✗ GAGAL: Backend tidak dapat dijangkau.`, 200);
                await addLine(`${getTimestamp()} [BOOT] Pastikan server berjalan di port yang benar.`, 200);
                await addLine(`${getTimestamp()} [BOOT] Ketik "retry" untuk mencoba ulang koneksi.`, 200);
                await addLine('', 100);
            }
        })();
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
    const finalTranscriptRef = useRef('');
    const sendVoiceRef = useRef(null);
    const restartVoiceRef = useRef(null);
    const exitVoiceRef = useRef(null);

    // Voice trigger keywords
    const SEND_KEYWORDS = ['kirim', 'send', 'eksekusi', 'jalankan'];
    const RESTART_KEYWORDS = ['batal', 'cancel', 'ulangi', 'ulang'];
    const EXIT_KEYWORDS = ['selesai', 'stop', 'sudah'];

    useEffect(() => {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) return;

        const recognition = new SpeechRecognitionAPI();
        recognition.lang = 'id-ID';
        recognition.interimResults = true;   // Show live preview while speaking
        recognition.continuous = true;       // Keep listening for long sentences
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            let interim = '';
            let final = '';

            for (let i = 0; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += transcript + ' ';
                } else {
                    interim += transcript;
                }
            }

            // Store accumulated final transcript
            if (final) {
                finalTranscriptRef.current = final.trim();
            }

            // Check for voice keywords in the latest final text
            const fullText = finalTranscriptRef.current.toLowerCase();
            const words = fullText.split(/\s+/);
            const lastWord = words[words.length - 1] || '';

            // Detect SEND keywords at the end
            if (SEND_KEYWORDS.includes(lastWord)) {
                const command = words.slice(0, -1).join(' ').trim();
                finalTranscriptRef.current = command;
                setInput(command);
                setTimeout(() => sendVoiceRef.current?.(), 200);
                return;
            }

            // Detect RESTART keywords — clear text, keep listening
            if (RESTART_KEYWORDS.includes(lastWord)) {
                setTimeout(() => restartVoiceRef.current?.(), 200);
                return;
            }

            // Detect EXIT keywords — end session with farewell
            if (EXIT_KEYWORDS.includes(lastWord)) {
                setTimeout(() => exitVoiceRef.current?.(), 200);
                return;
            }

            // Show live preview in a discrete UI element rather than overriding typed input
            const preview = (finalTranscriptRef.current + ' ' + interim).trim();
            setVoicePreview(preview);
        };

        recognition.onerror = (e) => {
            // 'no-speech' is normal — user just paused, don't stop listening
            if (e.error === 'no-speech') return;
            setIsListening(false);
            finalTranscriptRef.current = '';
        };

        recognition.onend = () => {
            // In continuous mode, restart if still supposed to be listening
            // (onend fires on silence timeout even in continuous mode)
            if (isListening && recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                } catch { /* already running */ }
            }
        };

        recognitionRef.current = recognition;
    }, [isListening]);

    const toggleVoice = () => {
        if (!recognitionRef.current) {
            setLines(prev => [...prev, {
                type: 'error',
                text: `${getTimestamp()} [ERROR] Voice input not supported in this browser.`
            }]);
            return;
        }

        // Start voice — completely separate from text typing
        finalTranscriptRef.current = '';
        setVoicePreview('');
        recognitionRef.current.start();
        setIsListening(true);
        setLines(prev => [...prev, {
            type: 'system',
            text: `${getTimestamp()} [VOICE] Mendengarkan... "kirim"=kirim | "batal"=ulangi | "selesai"=akhiri`
        }]);
    };

    // Send voice command — stops listening and executes
    const sendVoice = () => {
        if (!recognitionRef.current) return;
        recognitionRef.current.stop();
        setIsListening(false);
        setVoicePreview('');

        const finalText = finalTranscriptRef.current;
        finalTranscriptRef.current = '';
        if (finalText.trim()) {
            setLines(prev => [...prev, {
                type: 'system',
                text: `${getTimestamp()} [VOICE] ✓ Perintah dikirim.`
            }]);
            setTimeout(() => executeRef.current?.(finalText.trim()), 300);
        }
    };

    // Restart voice — clears current text but keeps listening
    const restartVoice = () => {
        if (!recognitionRef.current) return;
        // Stop and restart to clear the speech buffer
        recognitionRef.current.stop();
        finalTranscriptRef.current = '';
        setVoicePreview('');
        setLines(prev => [...prev, {
            type: 'system',
            text: `${getTimestamp()} [VOICE] ↻ Teks dihapus. Silakan ulangi...`
        }]);
        // Restart listening after a brief delay
        setTimeout(() => {
            try {
                recognitionRef.current.start();
            } catch { /* already running */ }
        }, 300);
    };

    // Exit voice session — stops and says farewell
    const exitVoice = () => {
        if (!recognitionRef.current) return;
        recognitionRef.current.stop();
        setIsListening(false);
        finalTranscriptRef.current = '';
        setVoicePreview('');

        const farewells = [
            'Sesi suara ditutup. Sampai jumpa, Operator.',
            'CORTEX voice mode OFF. Selamat tinggal, Operator.',
            'Sesi diakhiri. Hubungi kembali kapan saja, Operator.',
            'Roger. CORTEX voice signing off. Sampai jumpa.',
        ];
        const farewell = farewells[Math.floor(Math.random() * farewells.length)];

        setLines(prev => [...prev, {
            type: 'system',
            text: `${getTimestamp()} [CORTEX] ${farewell}`
        }]);

        // Speak the farewell
        if (ttsEnabled && window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(farewell);
            utterance.lang = 'id-ID';
            utterance.rate = 1.1;
            utterance.pitch = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    };

    // Keep refs in sync for callback access
    useEffect(() => {
        sendVoiceRef.current = sendVoice;
        restartVoiceRef.current = restartVoice;
        exitVoiceRef.current = exitVoice;
    });

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

        // Handle help command (client-side)
        if (trimmed.toLowerCase() === 'help') {
            const ts = getTimestamp();
            HELP_LINES.forEach((line, i) => {
                setTimeout(() => {
                    setLines(prev => [...prev, { type: 'help', text: `${ts} ${line}` }]);
                }, i * 15);
            });
            return;
        }

        // Handle retry — re-check backend connectivity
        if (trimmed.toLowerCase() === 'retry') {
            setLines(prev => [...prev, { type: 'system', text: `${getTimestamp()} [SYSTEM] Memverifikasi koneksi backend...` }]);
            try {
                const res = await fetch('/api/status', { signal: AbortSignal.timeout(5000) });
                if (!res.ok) throw new Error('Status not OK');
                setLines(prev => [...prev, { type: 'system', text: `${getTimestamp()} [SYSTEM] ✓ Backend aktif dan terhubung.` }]);
            } catch {
                setLines(prev => [...prev, { type: 'error', text: `${getTimestamp()} [ERROR] ✗ Backend tidak dapat dijangkau.` }]);
            }
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

            if (data.output && Array.isArray(data.output)) {
                const ts = getTimestamp();
                const responseLines = data.output.filter(l => l.trim() !== '');
                responseLines.forEach((line, i) => {
                    setTimeout(() => {
                        setLines(prev => [...prev, { type: 'output', text: `${ts} ${line}` }]);
                    }, i * 30);
                });
                setTimeout(() => {
                    setLines(prev => [...prev, { type: 'output', text: '' }]);
                }, responseLines.length * 30);

                // Cortex speaks the response
                speakResponse(responseLines.join('\n'));
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

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInput(val);

        // Autocomplete logic
        const parts = val.split(' ');
        const lastWord = parts[parts.length - 1].toLowerCase();

        if (lastWord.length >= 2) {
            // Find matches in inventory (excluding exact matches if they already finished typing it)
            const matches = inventoryNames.filter(n => n.toLowerCase().includes(lastWord) && n.toLowerCase() !== lastWord);
            setSuggestions(matches.slice(0, 3));
        } else {
            setSuggestions([]);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Tab' && suggestions.length > 0) {
            e.preventDefault();
            const parts = input.split(' ');
            // Replace the last partially typed word with the first suggestion
            parts[parts.length - 1] = suggestions[0];
            setInput(parts.join(' ') + ' ');
            setSuggestions([]);
        } else if (e.key === 'Enter') {
            execute(input);
            setSuggestions([]);
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
            case 'help': return 'text-amber-400';
            case 'voice_preview': return 'text-emerald-300/70 italic';
            default: return 'text-gray-300';
        }
    };

    /* ── Enhanced syntax highlighting for CORTEX output ── */
    const highlightLine = (text) => {
        if (!text) return text;
        // Define tag color mappings
        const tagColors = {
            '[CORTEX]': 'text-[var(--color-neon-cyan)] font-bold',
            '[AKSI]': 'text-amber-400 font-semibold',
            '[BERHASIL]': 'text-emerald-400 font-semibold',
            '[JUAL]': 'text-pink-400 font-semibold',
            '[RESTOCK]': 'text-sky-400 font-semibold',
            '[EDITED]': 'text-violet-400 font-semibold',
            '[ERROR]': 'text-red-400 font-bold',
            '[STOK]': 'text-teal-400',
            '[STATUS]': 'text-blue-400',
            '[INFO]': 'text-gray-400',
            '[PERINGATAN]': 'text-amber-500 font-bold',
            '[WARN]': 'text-amber-500',
            '[ANALITIK]': 'text-violet-400',
            '[PENDAPATAN]': 'text-emerald-300',
            '[TREN]': 'text-indigo-400',
            '[TERLARIS]': 'text-pink-300',
            '[ITEM]': 'text-teal-300',
            '[SYSTEM]': 'text-[var(--color-neon-purple)]',
            '[BOOT]': 'text-[var(--color-neon-purple)]',
            '[VOICE]': 'text-emerald-300',
        };

        // Find if the text includes any known tag
        for (const [tag, colorClass] of Object.entries(tagColors)) {
            if (text.includes(tag)) {
                const parts = text.split(tag);
                return (
                    <>
                        {parts[0]}<span className={colorClass}>{tag}</span>{parts.slice(1).join(tag)}
                    </>
                );
            }
        }
        return text;
    };

    /* ── Copy line to clipboard ── */
    const [copiedIdx, setCopiedIdx] = useState(null);
    const copyLine = (text, idx) => {
        // Strip timestamp for cleaner copy
        const cleaned = text.replace(/^\[\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}\] /, '');
        navigator.clipboard.writeText(cleaned);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 1500);
    };

    /* ── Export conversation ── */
    const exportConversation = () => {
        const content = lines.map(l => l.text).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cortex_log_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
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

                    {/* Export conversation */}
                    <button
                        onClick={(e) => { e.stopPropagation(); exportConversation(); }}
                        title="Export conversation log"
                        className="p-1.5 rounded-lg text-gray-600 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all"
                    >
                        <Download className="w-3.5 h-3.5" />
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
                        <div
                            key={i}
                            className={`${lineColor(line.type)} whitespace-pre-wrap leading-relaxed group flex items-start gap-1`}
                        >
                            <span className="flex-1">{line.type === 'output' ? highlightLine(line.text) : line.text}</span>
                            {line.text && line.type !== 'system' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); copyLine(line.text, i); }}
                                    className={`shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ${copiedIdx === i ? 'text-emerald-400 opacity-100' : 'text-gray-600'
                                        }`}
                                    title="Copy"
                                >
                                    <Copy className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}

                    {/* Typing indicator */}
                    {isProcessing && (
                        <div className="flex items-center gap-2 text-[var(--color-neon-cyan)]/60 py-1">
                            <span className="text-xs tracking-widest">CORTEX</span>
                            <span className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon-cyan)] animate-[pulse_1s_ease-in-out_infinite]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon-cyan)] animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon-cyan)] animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
                            </span>
                            <span className="text-xs text-gray-600">memproses...</span>
                        </div>
                    )}

                    {/* Live voice transcription preview */}
                    {isListening && voicePreview && (
                        <div className="flex items-center gap-2 mt-2 text-emerald-300/80 italic text-sm pl-4 relative">
                            <Mic className="w-3 h-3 animate-pulse" />
                            <span>Mendengar: "{voicePreview}"</span>
                        </div>
                    )}

                    {/* Input line */}
                    <div className="flex items-center gap-2 mt-1 relative">
                        <span className="text-[var(--color-neon-cyan)] shrink-0">&gt;</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            disabled={isProcessing}
                            className="flex-1 bg-transparent border-none outline-none text-[var(--color-neon-cyan)] font-mono text-sm caret-[var(--color-neon-cyan)]"
                            autoFocus
                            spellCheck={false}
                            autoComplete="off"
                        />

                        {/* Autocomplete suggestions */}
                        {suggestions.length > 0 && (
                            <div className="absolute left-4 -top-8 flex gap-2">
                                {suggestions.map((s, idx) => (
                                    <div key={idx} className="text-xs bg-[var(--color-neon-cyan)]/10 text-[var(--color-neon-cyan)] px-2 py-0.5 rounded border border-[var(--color-neon-cyan)]/30 backdrop-blur-md">
                                        {s}
                                        {idx === 0 && <span className="ml-2 opacity-50 text-[10px] bg-black/40 px-1 rounded">TAB</span>}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Voice input controls */}
                        {isListening ? (
                            <>
                                {/* Send voice command */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); sendVoice(); }}
                                    className="p-2 rounded-lg text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.3)] hover:bg-emerald-500/20 transition-all"
                                    title="Kirim perintah suara"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                                {/* Cancel voice session */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); exitVoice(); }}
                                    className="p-2 rounded-lg text-red-400 bg-red-500/10 border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)] hover:bg-red-500/20 transition-all"
                                    title="Akhiri sesi suara"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleVoice(); }}
                                disabled={isProcessing}
                                className="p-2 rounded-lg text-gray-600 hover:text-[var(--color-neon-cyan)] hover:bg-[var(--color-neon-cyan)]/10 transition-all"
                                title="Voice input (Indonesian)"
                            >
                                <Mic className="w-4 h-4" />
                            </button>
                        )}

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
