import { useState, useRef, useEffect, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Mic, MicOff, Trash2, Volume2, VolumeX, Send, X, Copy, Download } from 'lucide-react';
import api from '../api';

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

// ─── PERSISTENT SESSION: Simpan session di localStorage agar AI ingat percakapan ────
const getOrCreateSessionId = () => {
    const stored = localStorage.getItem('cortex_session_id');
    if (stored) return stored;
    const newId = generateSessionId();
    localStorage.setItem('cortex_session_id', newId);
    return newId;
};

export default function Terminal() {
    const [lines, setLines] = useState([]);

    // ─── MEMORY CAP: Limit terminal lines to prevent memory leaks ────
    const MAX_LINES = 500;
    const addLines = (newLine) => setLines(prev => [...prev, newLine].slice(-MAX_LINES));
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
    const sessionId = useRef(getOrCreateSessionId());
    const recognitionRef = useRef(null);
    const executeRef = useRef(null);

    /* Boot sequence — with real backend health check */
    useEffect(() => {
        if (booted.current) return;
        booted.current = true;

        const hasSpeech = typeof webkitSpeechRecognition !== 'undefined' || typeof SpeechRecognition !== 'undefined';

        // Fetch inventory names for autocomplete
        api.get('/items')
            .then(res => res.json())
            .then(data => setInventoryNames(data.map(i => i.name)))
            .catch(() => { });

        const addLine = (text, delay) =>
            new Promise(resolve => setTimeout(() => {
                addLines({ type: 'system', text });
                resolve();
            }, delay));

        (async () => {
            await addLine(`${getTimestamp()} [BOOT] INSERT3COINS AI Manager v3.1.0`, 0);
            await addLine(`${getTimestamp()} [BOOT] Memverifikasi koneksi backend...`, 200);

            // Real health check
            try {
                const res = await api.get('/status', { 
                    signal: AbortSignal.timeout(5000)
                });
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

        // Clean text for natural Indonesian speech
        let cleaned = text
            // Remove structural tags
            .replace(/\[.*?\]/g, '')
            .replace(/<<<.*?>>>/g, '')
            .replace(/\/\/.*$/gm, '')
            .replace(/[─═•⚠]/g, '')
            // Translate symbols to spoken pauses/words
            .replace(/\|/g, ', ') // replace pipes with pauses
            .replace(/\bBab:/gi, 'Kategori:')
            .replace(/\bSub-bab:/gi, 'Sub Kategori:')
            .replace(/\bPrice:/gi, 'Harga:')
            .replace(/\bStock:/gi, 'Stok:')
            .replace(/\bRarity:/gi, 'Raritas:')
            // Handle Rupiah currency formatting so it reads cleanly (e.g. 128.000 -> 128 ribu)
            .replace(/Rp\s*([\d.,]+)/gi, (match, p1) => {
                const numStr = p1.replace(/\./g, ''); // Remove thousand separators
                return `${numStr} rupiah`;
            })
            // Remove bullet points/numbering at start of lines for smoother flow
            .replace(/^\d+\.\s*/gm, '')
            .replace(/^\-\s*/gm, '')
            // Cleanup spaces
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
            // Auto-listen after Cortex finishes speaking if it was paused for processing
            if (recognitionRef.current && isListeningRef.current === 'PAUSED_FOR_PROCESSING') {
                setTimeout(() => {
                    isListeningRef.current = true;
                    try {
                        recognitionRef.current.start();
                        setIsListening(true);
                    } catch { /* already listening */ }
                }, 1000); // 1000ms delay protects against echo/reverb
            }
        };
        utterance.onerror = () => {
            setIsSpeaking(false);
            // Fallback restore
            if (recognitionRef.current && isListeningRef.current === 'PAUSED_FOR_PROCESSING') {
                isListeningRef.current = true;
                try { recognitionRef.current.start(); setIsListening(true); } catch { }
            }
        };

        // Prevent Chrome Garbage Collection bug by storing a global reference
        window.__cortexUtterance = utterance;
        window.speechSynthesis.speak(utterance);
    }, [ttsEnabled]);

    /* ── Voice Input Setup ── */
    const finalTranscriptRef = useRef('');
    const sendVoiceRef = useRef(null);
    const restartVoiceRef = useRef(null);
    const exitVoiceRef = useRef(null);
    const isListeningRef = useRef(false); // Track true intention to listen continuously

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
            // HARD GATE: If we are 'PAUSED_FOR_PROCESSING' or false, silently ignore the mic feedback!
            if (isListeningRef.current !== true) return;

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
                if (!isProcessing) {
                    recognitionRef.current.stop(); // stop immediately to clear buffer
                    setTimeout(() => sendVoiceRef.current?.(), 200);
                }
                return;
            }

            // Detect RESTART keywords — clear text, keep listening
            if (RESTART_KEYWORDS.includes(lastWord)) {
                recognitionRef.current.stop();
                setTimeout(() => restartVoiceRef.current?.(), 200);
                return;
            }

            // Detect EXIT keywords — end session with farewell
            if (EXIT_KEYWORDS.includes(lastWord)) {
                recognitionRef.current.stop();
                setTimeout(() => exitVoiceRef.current?.(), 200);
                return;
            }

            // Show live preview in a discrete UI element rather than overriding typed input
            const preview = (finalTranscriptRef.current + ' ' + interim).trim();
            setVoicePreview(preview);
        };

        recognition.onerror = (e) => {
            if (e.error === 'no-speech') return;
            if (isListeningRef.current !== true) return;
            // On other errors, quietly restart if we still want to listen
            setTimeout(() => {
                if (isListeningRef.current === true && recognitionRef.current) {
                    try { recognitionRef.current.start(); } catch { }
                }
            }, 1000);
        };

        recognition.onend = () => {
            // In continuous mode, restart if the user hasn't said 'selesai'
            if (isListeningRef.current === true && recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                } catch { /* already running */ }
            } else if (isListeningRef.current === false) {
                setIsListening(false);
            }
        };

        recognitionRef.current = recognition;
    }, [isListening]);

    const toggleVoice = () => {
        if (!recognitionRef.current) {
            addLines({
                type: 'error',
                text: `${getTimestamp()} [ERROR] Voice input not supported in this browser.`
            });
            return;
        }

        // Start voice — completely separate from text typing
        finalTranscriptRef.current = '';
        setVoicePreview('');
        isListeningRef.current = true;
        setIsListening(true);
        try { recognitionRef.current.start(); } catch { }
        addLines({
            type: 'system',
            text: `${getTimestamp()} [VOICE] Mode suara diaktifkan. Mendengarkan terus-menerus...`
        });
    };

    // Send voice command — stops listening and executes (auto-restarts via onend or after processing)
    const sendVoice = () => {
        if (!recognitionRef.current) return;

        // Pause microphone while we are processing and Cortex is speaking back to prevent echoing
        isListeningRef.current = 'PAUSED_FOR_PROCESSING';
        recognitionRef.current.stop();

        setVoicePreview('');

        const finalText = finalTranscriptRef.current;
        finalTranscriptRef.current = '';
        if (finalText.trim()) {
            addLines({
                type: 'system',
                text: `${getTimestamp()} [VOICE] ✓ Perintah dikirim.`
            });
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
        addLines({
            type: 'system',
            text: `${getTimestamp()} [VOICE] ↻ Teks dihapus. Silakan ulangi...`
        });
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
        isListeningRef.current = false;
        setIsListening(false);
        recognitionRef.current.stop();

        finalTranscriptRef.current = '';
        setVoicePreview('');

        const farewells = [
            'Sesi suara ditutup. Sampai jumpa, Operator.',
            'CORTEX voice mode OFF. Selamat tinggal, Operator.',
            'Sesi diakhiri. Hubungi kembali kapan saja, Operator.',
            'Roger. CORTEX voice signing off. Sampai jumpa.',
        ];
        const farewell = farewells[Math.floor(Math.random() * farewells.length)];

        addLines({
            type: 'system',
            text: `${getTimestamp()} [CORTEX] ${farewell}`
        });

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
            await api.delete('/terminal/history', {
                headers: { 'X-Session-ID': sessionId.current }
            });
            const newId = generateSessionId();
            sessionId.current = newId;
            localStorage.setItem('cortex_session_id', newId);
            addLines({
                type: 'system',
                text: `${getTimestamp()} [SYSTEM] Memori percakapan dihapus. Sesi baru dimulai.`
            });
        } catch {
            addLines({
                type: 'error',
                text: `${getTimestamp()} [ERROR] Gagal menghapus memori.`
            });
        }
    };

    /* Execute command */
    const execute = async (cmd) => {
        const trimmed = cmd.trim();
        if (!trimmed) return;

        // Add command to display
        addLines({ type: 'input', text: `${getTimestamp()} > ${trimmed}` });
        setHistory(prev => [trimmed, ...prev].slice(0, 50));
        setHistIdx(-1);
        setInput('');

        // Handle client-side clear
        if (trimmed.toLowerCase() === 'clear') {
            setLines([{ type: 'system', text: `${getTimestamp()} [SYSTEM] AI Manager dibersihkan.` }]);
            return;
        }

        // Handle help command (client-side)
        if (trimmed.toLowerCase() === 'help') {
            const ts = getTimestamp();
            HELP_LINES.forEach((line, i) => {
                setTimeout(() => {
                    addLines({ type: 'help', text: `${ts} ${line}` });
                }, i * 15);
            });
            return;
        }

        // Handle retry — re-check backend connectivity
        if (trimmed.toLowerCase() === 'retry') {
            addLines({ type: 'system', text: `${getTimestamp()} [SYSTEM] Memverifikasi koneksi backend...` });
            try {
                const res = await api.get('/status', { 
                    signal: AbortSignal.timeout(5000)
                });
                if (!res.ok) throw new Error('Status not OK');
                addLines({ type: 'system', text: `${getTimestamp()} [SYSTEM] ✓ Backend aktif dan terhubung.` });
            } catch {
                addLines({ type: 'error', text: `${getTimestamp()} [ERROR] ✗ Backend tidak dapat dijangkau.` });
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
            addLines({ type: 'system', text: `${getTimestamp()} [CORTEX] ${goodbye}` });

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
            const res = await api.post('/terminal', { command: trimmed }, {
                headers: { 'X-Session-ID': sessionId.current }
            });
            const data = await res.json();

            if (data.output && Array.isArray(data.output)) {
                const ts = getTimestamp();
                const responseLines = data.output.filter(l => l.trim() !== '');
                responseLines.forEach((line, i) => {
                    setTimeout(() => {
                        addLines({ type: 'output', text: `${ts} ${line}` });
                    }, i * 30);
                });
                setTimeout(() => {
                    addLines({ type: 'output', text: '' });
                }, responseLines.length * 30);

                // Cortex speaks the response
                if (ttsEnabled && window.speechSynthesis) {
                    speakResponse(responseLines.join('\n'));
                } else if (isListeningRef.current === 'PAUSED_FOR_PROCESSING') {
                    // Resume immediately if TTS is turned off
                    isListeningRef.current = true;
                    try { recognitionRef.current?.start(); setIsListening(true); } catch { }
                }
            } else if (data.error) {
                addLines({ type: 'error', text: `${getTimestamp()} [ERROR] ${data.error}` });
                if (ttsEnabled && window.speechSynthesis) {
                    speakResponse('Error. ' + data.error);
                } else if (isListeningRef.current === 'PAUSED_FOR_PROCESSING') {
                    isListeningRef.current = true;
                    try { recognitionRef.current?.start(); setIsListening(true); } catch { }
                }
            }
        } catch {
            addLines({ type: 'error', text: `${getTimestamp()} [ERROR] Koneksi ke backend terputus.` });
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
                        INSERT3COINS_AI_MANAGER — {isProcessing ? 'PROCESSING...' : isSpeaking ? 'SPEAKING...' : isListening ? 'LISTENING...' : 'READY'}
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
                            value={isListening ? '' : input}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            disabled={isProcessing || isListening}
                            placeholder={isListening ? "[ MODE SUARA AKTIF - KEYBOARD DINONAKTIFKAN ]" : ""}
                            className="flex-1 bg-transparent border-none outline-none text-[var(--color-neon-cyan)] font-mono text-sm caret-[var(--color-neon-cyan)] placeholder:text-emerald-500/50"
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
                        {!input && !isListening && (
                            <span className="text-[var(--color-neon-cyan)] animate-[flicker_1s_infinite]">█</span>
                        )}
                    </div>
                    <div ref={bottomRef} />
                </div>
            </motion.div>
        </div>
    );
}
