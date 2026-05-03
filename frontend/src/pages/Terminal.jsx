import { useState, useRef, useEffect, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Mic, MicOff, Trash2, Volume2, VolumeX, Send, X, Copy, Download, Camera } from 'lucide-react';
import api from '../api';

/* ── Help command: data terstruktur per seksi ── */
const HELP_SECTIONS = [
  {
    icon: '⚙️', label: 'SISTEM',
    color: 'from-purple-500/20 to-purple-900/10',
    border: 'border-purple-500/30',
    badge: 'bg-purple-500/20 text-purple-300',
    commands: [
      { cmd: 'help',          desc: 'Tampilkan panduan ini' },
      { cmd: 'clear',         desc: 'Bersihkan layar terminal' },
      { cmd: 'retry',         desc: 'Cek ulang koneksi backend' },
      { cmd: 'system reindex', desc: 'Urutkan ulang database A-Z' },
    ],
  },
  {
    icon: '📦', label: 'INVENTORI',
    color: 'from-cyan-500/20 to-cyan-900/10',
    border: 'border-cyan-500/30',
    badge: 'bg-cyan-500/20 text-cyan-300',
    commands: [
      { cmd: 'tampilkan semua stok', desc: 'Lihat seluruh inventori' },
      { cmd: 'stok rendah',          desc: 'Item dengan stok < 2 unit' },
      { cmd: 'cari [nama]',          desc: 'Cari item berdasarkan nama', example: 'cari daikin' },
    ],
  },
  {
    icon: '💸', label: 'TRANSAKSI',
    color: 'from-emerald-500/20 to-emerald-900/10',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-300',
    commands: [
      { cmd: 'jual [N] [item]',       desc: 'Jual N unit item', example: 'jual 2 remote daikin' },
      { cmd: 'tambah stok [N] [item]', desc: 'Restock N unit', example: 'tambah stok 10 sharp' },
      { cmd: 'buat [nama]',            desc: 'Tambah item baru ke inventori', example: 'buat Remote LG AKB75375604' },
      { cmd: 'hapus [item]',           desc: 'Hapus item dari inventori', example: 'hapus remote rusak' },
    ],
  },
  {
    icon: '✏️', label: 'EDIT ITEM',
    color: 'from-amber-500/20 to-amber-900/10',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300',
    commands: [
      { cmd: 'ubah [item] menjadi [nama]', desc: 'Ganti nama item', example: 'ubah remote A ke Remote Daikin FT' },
      { cmd: 'stok [item] [N]',            desc: 'Set stok item ke angka tertentu', example: 'stok remote sharp 15' },
      { cmd: 'harga [item] [N]',           desc: 'Set harga item', example: 'harga remote daikin 75000' },
    ],
  },
  {
    icon: '📊', label: 'ANALITIK',
    color: 'from-violet-500/20 to-violet-900/10',
    border: 'border-violet-500/30',
    badge: 'bg-violet-500/20 text-violet-300',
    commands: [
      { cmd: 'laporan penjualan', desc: 'Ringkasan penjualan hari ini' },
      { cmd: 'item terlaris',     desc: 'Top 5 item terlaris sepanjang waktu' },
      { cmd: 'total pendapatan',  desc: 'Total revenue keseluruhan' },
    ],
  },
  {
    icon: '🎤', label: 'VOICE & SHORTCUT',
    color: 'from-rose-500/20 to-rose-900/10',
    border: 'border-rose-500/30',
    badge: 'bg-rose-500/20 text-rose-300',
    commands: [
      { cmd: 'Tap 🎤',       desc: 'Mulai perintah suara' },
      { cmd: '"kirim"',      desc: 'Kirim perintah saat voice aktif' },
      { cmd: '"batal"',      desc: 'Ulangi input suara' },
      { cmd: '↑ / ↓',        desc: 'Navigasi riwayat perintah' },
      { cmd: '🗑️ (tombol)',   desc: 'Hapus memori percakapan CORTEX' },
    ],
  },
];

// Sentinel khusus — satu line yang membawa seluruh data help card
const HELP_CARD_LINE = { type: 'help_card', text: '__HELP_CARD__', sections: HELP_SECTIONS };

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
    const [lines, setLines] = useState(() => {
        try {
            const saved = localStorage.getItem('cortex_terminal_lines');
            if (saved) {
                const parsed = JSON.parse(saved);
                return Array.isArray(parsed) ? parsed : [];
            }
        } catch (e) {
            console.error('Failed to parse local storage lines', e);
        }
        return [];
    });

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
    const [suggestionType, setSuggestionType] = useState('item'); // 'item' | 'command'
    const [pendingImage, setPendingImage] = useState(null);   // base64 gambar yang siap dikirim
    const [imagePreview, setImagePreview] = useState(null);    // URL preview gambar
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const booted = useRef(false);
    const sessionId = useRef(getOrCreateSessionId());
    const recognitionRef = useRef(null);
    const executeRef = useRef(null);
    const cameraInputRef = useRef(null);

    /* Boot sequence — with real backend health check */
    useEffect(() => {
        if (booted.current) return;
        booted.current = true;

        const hasSpeech = typeof webkitSpeechRecognition !== 'undefined' || typeof SpeechRecognition !== 'undefined';

        // Fetch inventory names for autocomplete (initial)
        const fetchInventoryNames = () => {
            api.get('/items')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setInventoryNames(data.map(i => i.name));
                })
                .catch(() => { });
        };
        fetchInventoryNames();
        // Refresh setiap 60 detik agar item baru langsung tersedia di autocomplete
        const refreshInterval = setInterval(fetchInventoryNames, 60_000);
        return () => clearInterval(refreshInterval);

        const addLine = (text, delay) =>
            new Promise(resolve => setTimeout(() => {
                addLines({ type: 'system', text });
                resolve();
            }, delay));

        (async () => {
            const isRestored = localStorage.getItem('cortex_terminal_lines') !== null;
            
            if (!isRestored) {
                await addLine(`${getTimestamp()} [BOOT] INSERT3COINS AI Manager v3.1.0`, 0);
                await addLine(`${getTimestamp()} [BOOT] Memverifikasi koneksi backend...`, 200);
            }

            // Real health check
            try {
                const res = await api.get('/status', { 
                    signal: AbortSignal.timeout(5000)
                });
                if (!res.ok) throw new Error('Status not OK');
                
                if (!isRestored) {
                    await addLine(`${getTimestamp()} [BOOT] Enkripsi: AES-256 ✓ | TLS 1.3 ✓`, 200);
                    await addLine(`${getTimestamp()} [BOOT] CORTEX AI: Analitik ✓ | Multi-Aksi ✓ | Memori ✓`, 200);
                    await addLine(`${getTimestamp()} [BOOT] Input Suara: ${hasSpeech ? 'AKTIF ✓' : 'TIDAK_TERSEDIA'}`, 200);
                    await addLine(`${getTimestamp()} [BOOT] Koneksi berhasil. Ketik "help" untuk daftar perintah.`, 200);
                    await addLine('', 100);
                }
            } catch {
                if (!isRestored) {
                    await addLine(`${getTimestamp()} [BOOT] ✗ GAGAL: Backend tidak dapat dijangkau.`, 200);
                    await addLine(`${getTimestamp()} [BOOT] Pastikan server berjalan di port yang benar.`, 200);
                    await addLine(`${getTimestamp()} [BOOT] Ketik "retry" untuk mencoba ulang koneksi.`, 200);
                    await addLine('', 100);
                } else {
                    addLines({ type: 'error', text: `${getTimestamp()} [ERROR] ✗ GAGAL: Backend tidak dapat dijangkau.` });
                }
            }
        })();
    }, []);

    // ─── SSE: Dengarkan siaran langsung dari Backend (Live Terminal Broadcasts) ───
    useEffect(() => {
        const token = localStorage.getItem('cortex_token');
        if (!token) return;

        // Buka jalur Server-Sent Events dengan melampirkan Token di URL
        const eventSource = new EventSource(`/api/terminal/stream?token=${token}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'broadcast' && data.output) {
                    data.output.forEach(text => {
                        addLines({ type: 'system', text });
                    });
                }
            } catch (err) {
                console.error('[SSE] Gagal mem-parsing paket data:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('[SSE] Sambungan terputus atau error:', err);
            eventSource.close();
        };

        // Bersihkan sambungan radio saat komponen layar ditutup
        return () => {
            eventSource.close();
        };
    }, [ttsEnabled]);

    // Sync lines to localStorage whenever it changes
    useEffect(() => {
        if (lines.length > 0) {
            localStorage.setItem('cortex_terminal_lines', JSON.stringify(lines));
        } else {
            localStorage.removeItem('cortex_terminal_lines');
        }
    }, [lines]);

    /* Auto-scroll */
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [lines]);

    /* Focus input on click anywhere */
    const focusInput = useCallback(() => inputRef.current?.focus(), []);

    // Preload TTS voices for mobile browsers to prevent English fallback
    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.getVoices();
            window.speechSynthesis.onvoiceschanged = () => {
                window.speechSynthesis.getVoices();
            };
        }
    }, []);

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

        const attemptSpeak = () => {
            const voices = window.speechSynthesis.getVoices();

            // Helper: cek apakah suara mengandung kata kunci Indonesia
            const isIndoVoice = (v) =>
                v.lang.startsWith('id') || v.lang.startsWith('in-') ||
                v.name.toLowerCase().includes('indonesia') ||
                v.name.toLowerCase().includes('indonesian');

            // Helper: cek apakah suara adalah suara wanita
            const isFemale = (v) => {
                const n = v.name.toLowerCase();
                return n.includes('female') || n.includes('wanita') ||
                    n.includes('woman') || n.includes('girl') ||
                    // Google Bahasa Indonesia (desktop Chrome) adalah suara wanita
                    (n.includes('indonesia') && !n.includes('male'));
            };

            // Tier 1: Suara Indonesia Wanita dari Google (desktop Chrome)
            let preferred = voices.find(v => isIndoVoice(v) && isFemale(v) && v.name.toLowerCase().includes('google'));
            // Tier 2: Suara Indonesia Wanita apapun
            if (!preferred) preferred = voices.find(v => isIndoVoice(v) && isFemale(v));
            // Tier 3: Suara Indonesia dari Google (fallback, termasuk pria)
            if (!preferred) preferred = voices.find(v => isIndoVoice(v) && v.name.toLowerCase().includes('google'));
            // Tier 4: Suara Indonesia apapun yang tersedia
            if (!preferred) preferred = voices.find(v => isIndoVoice(v));

            if (preferred) {
                utterance.voice = preferred;
                utterance.lang = preferred.lang;
                // Naikkan sedikit pitch jika suaranya bukan wanita agar lebih nyaman
                if (!isFemale(preferred)) utterance.pitch = 1.2;
            } else {
                // Fallback paksa ke kode bahasa Indonesia
                utterance.lang = 'id-ID';
            }

            // Prevent Chrome Garbage Collection bug by storing a global reference
            window.__cortexUtterance = utterance;
            window.speechSynthesis.speak(utterance);
        };

        // Mobile browsers load voices asynchronously. Wait for them if empty.
        if (window.speechSynthesis.getVoices().length === 0) {
            let triggered = false;
            window.speechSynthesis.onvoiceschanged = () => {
                if (!triggered) {
                    triggered = true;
                    attemptSpeak();
                }
            };
            // Failsafe timer if onvoiceschanged doesn't fire
            setTimeout(() => {
                if (!triggered) {
                    triggered = true;
                    attemptSpeak();
                }
            }, 800);
        } else {
            attemptSpeak();
        }
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
            let newFinal = '';

            // FIX: Gunakan event.resultIndex sebagai start index.
            // Web Speech API bersifat kumulatif — event.results berisi SEMUA hasil lama + baru.
            // Jika kita loop dari i=0, kata-kata lama akan terbaca ulang di setiap event
            // dan menyebabkan duplikasi ("tambahkan tambahkan remote remote").
            // Dengan mulai dari event.resultIndex, kita HANYA memproses hasil BARU.
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    newFinal += transcript + ' ';
                } else {
                    interim += transcript;
                }
            }

            // Akumulasikan ke ref yang sudah ada (bukan replace seluruhnya)
            if (newFinal) {
                finalTranscriptRef.current = (finalTranscriptRef.current + ' ' + newFinal).trim();
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

        // FIX: Dependency array dikosongkan [] — recognition HANYA dibuat sekali saat mount.
        // Sebelumnya [isListening] menyebabkan instance baru dibuat setiap state berubah,
        // sehingga dua instance bisa berjalan bersamaan di HP dan menghasilkan input ganda.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
            setLines([{
                type: 'system',
                text: `${getTimestamp()} [SYSTEM] Memori percakapan dihapus. Sesi baru dimulai.`
            }]);
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

        // Handle help command (client-side) — render sebagai help card responsif
        if (trimmed.toLowerCase() === 'help') {
            addLines(HELP_CARD_LINE);
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

    // Kata-kata perintah yang bisa di-autocomplete
    const COMMAND_WORDS = [
        'tampilkan semua stok', 'stok rendah', 'laporan penjualan',
        'item terlaris', 'total pendapatan', 'system reindex',
        'tampilkan', 'tambah stok', 'tambah', 'jual', 'cari', 'hapus',
        'ubah', 'harga', 'stok', 'buat', 'clear', 'help', 'retry',
    ];

    // Kata-kata perintah yang mengindikasikan bahwa kata berikutnya adalah nama item
    const ITEM_TRIGGER_WORDS = [
        'jual', 'tambah', 'tambah stok', 'cari', 'hapus', 'ubah', 'harga', 'stok', 'buat',
    ];

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInput(val);

        const lower = val.toLowerCase().trim();
        const parts = lower.split(' ');
        const lastWord = parts[parts.length - 1];

        // Jangan tampilkan suggestion jika input terlalu pendek
        if (lower.length < 2) {
            setSuggestions([]);
            return;
        }

        // Cek apakah bagian awal perintah cocok dengan ITEM_TRIGGER_WORDS
        // Jika ya, suggest nama item
        const isItemContext = ITEM_TRIGGER_WORDS.some(trigger => lower.startsWith(trigger + ' '));

        if (isItemContext && lastWord.length >= 1) {
            // Mode suggest item: cocokkan nama item berdasarkan kata terakhir
            const matches = inventoryNames.filter(n =>
                n.toLowerCase().includes(lastWord) && n.toLowerCase() !== lastWord
            );
            setSuggestions(matches.slice(0, 4));
            setSuggestionType('item');
        } else if (!isItemContext && lastWord.length >= 2) {
            // Mode suggest perintah: cocokkan kata perintah
            const matches = COMMAND_WORDS.filter(cmd =>
                cmd.startsWith(lower) && cmd !== lower
            );
            setSuggestions(matches.slice(0, 4));
            setSuggestionType('command');
        } else {
            setSuggestions([]);
        }
    };

    // Fungsi untuk menerapkan suggestion — bisa dipanggil dari klik/tap (HP) maupun TAB (PC)
    const applySuggestion = (suggestion) => {
        let newInput;
        if (suggestionType === 'command') {
            // Untuk perintah, ganti seluruh input dengan perintah yang dipilih
            newInput = suggestion + ' ';
        } else {
            // Untuk nama item, ganti hanya kata terakhir
            const parts = input.split(' ');
            parts[parts.length - 1] = suggestion;
            newInput = parts.join(' ') + ' ';
        }
        setInput(newInput);
        setSuggestions([]);
        // Trigger ulang autocomplete untuk konteks baru (nama item setelah perintah)
        const fakeEvent = { target: { value: newInput } };
        handleInputChange(fakeEvent);
        // Kembalikan fokus ke input setelah tap di HP
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Tab' && suggestions.length > 0) {
            e.preventDefault();
            applySuggestion(suggestions[0]);
        } else if (e.key === 'Enter') {
            // Jika ada foto tertempel, kirim via Vision endpoint
            if (pendingImage) {
                sendVision();
            } else {
                execute(input);
            }
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

    /* ── CORTEX Vision: Image compression utility ── */
    const compressImage = (file, maxWidth = 1024, quality = 0.8) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width;
                    let h = img.height;
                    // Resize jika lebih besar dari maxWidth (hemat bandwidth gudang)
                    if (w > maxWidth) {
                        h = Math.round((h * maxWidth) / w);
                        w = maxWidth;
                    }
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    /* ── CORTEX Vision: Handle image selection from camera/gallery ── */
    const handleImageSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            addLines({ type: 'error', text: `${getTimestamp()} [VISION ERROR] Tipe file tidak didukung. Gunakan JPEG, PNG, atau WebP.` });
            return;
        }

        // Validate size (raw, sebelum kompresi)
        if (file.size > 10 * 1024 * 1024) {
            addLines({ type: 'error', text: `${getTimestamp()} [VISION ERROR] Ukuran file terlalu besar (maks 10MB).` });
            return;
        }

        try {
            addLines({ type: 'system', text: `${getTimestamp()} [VISION] 📷 Memproses gambar...` });
            const compressed = await compressImage(file);
            setPendingImage(compressed);
            setImagePreview(compressed);
            addLines({ type: 'system', text: `${getTimestamp()} [VISION] ✓ Foto siap. Ketik perintah lalu Enter (misal: "tambah produk ini").` });
            inputRef.current?.focus();
        } catch (err) {
            console.error('[VISION] Image compression failed:', err);
            addLines({ type: 'error', text: `${getTimestamp()} [VISION ERROR] Gagal memproses gambar.` });
        }

        // Reset file input agar bisa pilih foto yang sama lagi
        e.target.value = '';
    };

    /* ── CORTEX Vision: Send image + command to backend ── */
    const sendVision = async () => {
        if (!pendingImage) return;

        const cmd = input.trim() || 'tambah produk ini';  // Default command jika kosong
        addLines({ type: 'input', text: `${getTimestamp()} > [VISION] ${cmd}` });
        setHistory(prev => [cmd, ...prev].slice(0, 50));
        setHistIdx(-1);
        setInput('');
        setIsProcessing(true);

        try {
            const res = await api.postVision(pendingImage, cmd, {
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
                }
            } else if (data.error) {
                addLines({ type: 'error', text: `${getTimestamp()} [ERROR] ${data.error}` });
            }
        } catch (err) {
            console.error('[VISION] Send failed:', err);
            addLines({ type: 'error', text: `${getTimestamp()} [VISION ERROR] Koneksi ke backend terputus.` });
        } finally {
            setIsProcessing(false);
            // Clear image after sending
            setPendingImage(null);
            setImagePreview(null);
        }
    };

    /* ── CORTEX Vision: Cancel pending image ── */
    const cancelImage = () => {
        setPendingImage(null);
        setImagePreview(null);
        addLines({ type: 'system', text: `${getTimestamp()} [VISION] Foto dibatalkan.` });
        inputRef.current?.focus();
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
                    {lines.map((line, i) => {
                        // ── Render khusus untuk Help Card (mobile-friendly) ──
                        if (line.type === 'help_card') {
                            return (
                                <div key={i} className="my-3 font-sans">
                                    {/* Header */}
                                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-cyan-500/20">
                                        <span className="text-[10px] font-mono tracking-widest text-cyan-500">CORTEX</span>
                                        <span className="text-[10px] font-mono text-gray-600">COMMAND REFERENCE v3.1.0</span>
                                        <span className="ml-auto text-[9px] font-mono text-gray-700">Tap perintah untuk mengisi input</span>
                                    </div>

                                    {/* Grid seksi — 1 kolom di HP, 2 kolom di desktop */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {line.sections.map((section) => (
                                            <div
                                                key={section.label}
                                                className={`rounded-xl border ${section.border} bg-gradient-to-br ${section.color} p-3`}
                                            >
                                                {/* Section header */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-base">{section.icon}</span>
                                                    <span className={`text-[9px] font-mono tracking-widest px-1.5 py-0.5 rounded ${section.badge}`}>
                                                        {section.label}
                                                    </span>
                                                </div>

                                                {/* Commands */}
                                                <div className="space-y-1.5">
                                                    {section.commands.map((c) => (
                                                        <div
                                                            key={c.cmd}
                                                            className="group flex items-start gap-2"
                                                        >
                                                            {/* Tombol tap command */}
                                                            {!c.cmd.startsWith('↑') && !c.cmd.startsWith('Tap') && !c.cmd.startsWith('"') ? (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        // Isi input dengan contoh atau perintah (tanpa placeholder bracket)
                                                                        const fill = c.example || c.cmd;
                                                                        setInput(fill);
                                                                        inputRef.current?.focus();
                                                                    }}
                                                                    className={`shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded border ${section.border} hover:ring-1 hover:ring-white/20 transition-all cursor-pointer text-left`}
                                                                    style={{ color: 'inherit', opacity: 0.9 }}
                                                                    title={c.example ? `Klik → isi: "${c.example}"` : `Klik → isi perintah`}
                                                                >
                                                                    {c.cmd}
                                                                </button>
                                                            ) : (
                                                                <span className={`shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded border ${section.border} opacity-60`}>
                                                                    {c.cmd}
                                                                </span>
                                                            )}
                                                            <span className="text-[11px] text-gray-400 leading-snug pt-0.5">
                                                                {c.desc}
                                                                {c.example && (
                                                                    <span className="block text-[9px] text-gray-600 mt-0.5 font-mono">
                                                                        contoh: {c.example}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Footer tip */}
                                    <p className="mt-2 text-[9px] font-mono text-gray-700 text-center">
                                        Atau ketik perintah bebas dalam bahasa Indonesia — CORTEX akan memahaminya
                                    </p>
                                </div>
                            );
                        }

                        // ── Render normal untuk semua tipe lain ──
                        return (
                            <div
                                key={i}
                                className={`${lineColor(line.type)} whitespace-pre-wrap leading-relaxed group flex items-start gap-1`}
                            >
                                <span className="flex-1">{line.type === 'output' ? highlightLine(line.text) : line.text}</span>
                                {line.text && line.type !== 'system' && line.type !== 'help_card' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); copyLine(line.text, i); }}
                                        className={`shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ${
                                            copiedIdx === i ? 'text-emerald-400 opacity-100' : 'text-gray-600'
                                        }`}
                                        title="Copy"
                                    >
                                        <Copy className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        );
                    })}

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
                            placeholder={isListening ? "[ MODE SUARA AKTIF - KEYBOARD DINONAKTIFKAN ]" : pendingImage ? "Ketik perintah (misal: tambah produk ini)" : ""}
                            className="flex-1 bg-transparent border-none outline-none text-[var(--color-neon-cyan)] font-mono text-sm caret-[var(--color-neon-cyan)] placeholder:text-emerald-500/50"
                            autoFocus
                            spellCheck={false}
                            autoComplete="off"
                        />

                        {/* Autocomplete suggestions — bisa diklik/disentuh (HP) ATAU tekan TAB (PC) */}
                        {/* POSISI: di BAWAH input agar tidak tertutup keyboard virtual HP */}

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
                            <>
                                {/* Camera / Vision button */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                                    disabled={isProcessing}
                                    className={`p-2 rounded-lg transition-all ${
                                        pendingImage
                                            ? 'text-amber-400 bg-amber-500/10 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                                            : 'text-gray-600 hover:text-amber-400 hover:bg-amber-400/10'
                                    }`}
                                    title="Scan foto (CORTEX Vision)"
                                >
                                    <Camera className="w-4 h-4" />
                                </button>
                                {/* Hidden file input for camera/gallery */}
                                <input
                                    ref={cameraInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    capture="environment"
                                    className="hidden"
                                    onChange={handleImageSelect}
                                />
                                {/* Voice input button */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleVoice(); }}
                                    disabled={isProcessing}
                                    className="p-2 rounded-lg text-gray-600 hover:text-[var(--color-neon-cyan)] hover:bg-[var(--color-neon-cyan)]/10 transition-all"
                                    title="Voice input (Indonesian)"
                                >
                                    <Mic className="w-4 h-4" />
                                </button>
                            </>
                        )}

                        {/* Send vision button — muncul saat ada foto terpasang */}
                        {pendingImage && (
                            <button
                                onClick={(e) => { e.stopPropagation(); sendVision(); }}
                                disabled={isProcessing}
                                className="p-2 rounded-lg text-amber-400 bg-amber-500/10 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.3)] hover:bg-amber-500/20 transition-all animate-pulse"
                                title="Kirim foto ke CORTEX Vision"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        )}

                        {/* Blinking cursor */}
                        {!input && !isListening && !pendingImage && (
                            <span className="text-[var(--color-neon-cyan)] animate-[flicker_1s_infinite]">█</span>
                        )}
                    </div>

                    {/* Image preview — muncul di bawah input saat foto terpasang */}
                    {imagePreview && (
                        <div className="relative mx-2 mt-1 mb-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                            <div className="flex items-start gap-3">
                                <img
                                    src={imagePreview}
                                    alt="Preview scan"
                                    className="w-16 h-16 object-cover rounded-md border border-amber-500/30"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-amber-400 font-mono">[VISION] 📷 Foto siap dipindai</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">Ketik perintah lalu tekan Enter atau klik tombol kirim</p>
                                    <p className="text-[10px] text-gray-600 mt-0.5">Contoh: "tambah produk ini", "cek produk ini", "jual produk ini"</p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); cancelImage(); }}
                                    className="shrink-0 p-1 rounded text-gray-500 hover:text-red-400 transition-colors"
                                    title="Batalkan foto"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Autocomplete suggestions — di bawah input bar, aman dari keyboard HP */}
                    {suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-2 pt-1 pb-2 border-t border-white/5">
                            {/* Label konteks */}
                            <span className="text-[10px] text-gray-600 font-mono self-center shrink-0">
                                {suggestionType === 'command' ? '⌘ perintah:' : '📦 item:'}
                            </span>
                            {suggestions.map((s, idx) => (
                                <button
                                    key={idx}
                                    // onMouseDown mencegah input kehilangan fokus sebelum klik terdaftar (PC)
                                    onMouseDown={(e) => { e.preventDefault(); applySuggestion(s); }}
                                    // onTouchEnd untuk HP — mencegah ghost click
                                    onTouchEnd={(e) => { e.preventDefault(); applySuggestion(s); }}
                                    className="text-xs bg-[var(--color-neon-cyan)]/10 text-[var(--color-neon-cyan)] px-2.5 py-1 rounded-md border border-[var(--color-neon-cyan)]/30 backdrop-blur-md active:scale-95 active:bg-[var(--color-neon-cyan)]/30 hover:bg-[var(--color-neon-cyan)]/20 transition-all cursor-pointer select-none flex items-center gap-1.5 touch-manipulation"
                                >
                                    {s}
                                    {/* Label TAB hanya muncul di layar besar (desktop) */}
                                    {idx === 0 && (
                                        <span className="hidden md:inline opacity-40 text-[10px] font-mono bg-black/40 px-1 rounded">TAB</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    <div ref={bottomRef} />
                </div>
            </motion.div>
        </div>
    );
}
