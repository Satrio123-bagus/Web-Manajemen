import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Html5Qrcode } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CameraOff, Box, Package, ArrowRightLeft, X, CheckCircle, RefreshCw, ScanLine, AlertTriangle, Keyboard } from 'lucide-react';
import api from '../api';

export default function MobileScanner() {
    const [scannedLocation, setScannedLocation] = useState(null);
    const [mode, setMode] = useState('SELL');
    const [selectedItemToMove, setSelectedItemToMove] = useState(null);
    const [isScanningDestination, setIsScanningDestination] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraError, setCameraError] = useState(null); // Pesan error kamera
    const [manualInput, setManualInput] = useState(''); // Fallback input manual
    const [showManualInput, setShowManualInput] = useState(false);
    const [toast, setToast] = useState(null);
    
    const scannerRef = useRef(null);
    const queryClient = useQueryClient();

    // Fetch inventory
    const { data: items = [], isLoading } = useQuery({
        queryKey: ['items', 'all_for_scanner'],
        queryFn: async () => {
            const res = await api.get('/items?limit=5000');
            if (!res.ok) throw new Error('Fetch failed');
            const result = await res.json();
            return result.data || result;
        }
    });

    // Sell Mutation
    const sellMutation = useMutation({
        mutationFn: async (id) => {
            const res = await api.post('/sales/sell', { id, quantity: 1 });
            if (!res.ok) throw new Error('Gagal menjual barang');
            return await res.json();
        },
        onSuccess: (data) => {
            showToast(`Terjual! Sisa: ${data.remaining_stock}`, 'success');
            queryClient.invalidateQueries({ queryKey: ['items'] });
        },
        onError: () => showToast('Gagal memproses penjualan', 'error')
    });

    // Move Mutation
    const moveMutation = useMutation({
        mutationFn: async ({ id, newLocation }) => {
            const res = await api.post('/items/move-location', { id, newLocation });
            if (!res.ok) throw new Error('Gagal memindah lokasi');
            return await res.json();
        },
        onSuccess: (data) => {
            showToast(`${data.name} → ${data.newLocation}`, 'success');
            queryClient.invalidateQueries({ queryKey: ['items'] });
            setSelectedItemToMove(null);
            setIsScanningDestination(false);
            setScannedLocation(null);
            setCameraActive(false);
        },
        onError: () => showToast('Gagal memindah barang', 'error')
    });

    const showToast = (msg, type) => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Filter items by scanned location
    const locationItems = items.filter(i => 
        (i.location || 'BELUM DITENTUKAN').toUpperCase() === scannedLocation
    );

    // ─── Menyalakan kamera dengan izin eksplisit ────────────────────────────
    const startScanner = useCallback(async () => {
        if (scannerRef.current) return;
        setCameraError(null);

        // LANGKAH 1: Minta izin kamera secara eksplisit ke browser
        // Ini yang memicu pop-up "Izinkan kamera?" di HP
        try {
            const testStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            // Matikan stream tes setelah izin diberikan
            testStream.getTracks().forEach(track => track.stop());
        } catch (err) {
            // Izin ditolak atau kamera tidak tersedia
            if (err.name === 'NotAllowedError') {
                setCameraError('BLOCKED');
            } else if (err.name === 'NotFoundError') {
                setCameraError('NOT_FOUND');
            } else if (err.name === 'NotReadableError') {
                setCameraError('IN_USE');
            } else {
                setCameraError('UNKNOWN');
            }
            setCameraActive(false);
            return;
        }

        // LANGKAH 2: Izin diberikan, mulai scanner QR
        // Beri waktu DOM untuk render container
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const readerEl = document.getElementById('reader');
        if (!readerEl) {
            setCameraError('DOM_ERROR');
            setCameraActive(false);
            return;
        }

        try {
            const html5Qr = new Html5Qrcode("reader");
            
            await html5Qr.start(
                { facingMode: "environment" }, // Kamera belakang HP
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                },
                (decodedText) => {
                    const cleanLoc = decodedText.trim().toUpperCase();

                    // Matikan kamera segera setelah scan berhasil
                    html5Qr.stop().catch(() => {});
                    scannerRef.current = null;
                    setCameraActive(false);

                    if (isScanningDestination && selectedItemToMove) {
                        moveMutation.mutate({ id: selectedItemToMove.id, newLocation: cleanLoc });
                    } else {
                        setScannedLocation(cleanLoc);
                    }
                },
                () => {
                    // Ignore — belum ada QR terdeteksi
                }
            );

            scannerRef.current = html5Qr;
        } catch (err) {
            console.error('Scanner start error:', err);
            setCameraError('START_FAILED');
            setCameraActive(false);
        }
    }, [isScanningDestination, selectedItemToMove, moveMutation]);

    const stopScanner = useCallback(async () => {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
            } catch (e) {
                console.error('Stop scanner error:', e);
            }
            scannerRef.current = null;
        }
    }, []);

    // Efek: nyalakan/matikan kamera berdasarkan state cameraActive
    useEffect(() => {
        if (cameraActive) {
            startScanner();
        } else {
            stopScanner();
        }
        return () => { stopScanner(); };
    }, [cameraActive, startScanner, stopScanner]);

    // Deteksi layar mati/tab berpindah → matikan kamera otomatis
    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden && cameraActive) {
                stopScanner();
                setCameraActive(false);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [stopScanner, cameraActive]);

    const handleActivateCamera = () => {
        setCameraError(null);
        setShowManualInput(false);
        setCameraActive(true);
    };

    // ─── Fallback: Input Manual ─────────────────────────────────────────────
    const handleManualSubmit = (e) => {
        e.preventDefault();
        const cleanLoc = manualInput.trim().toUpperCase();
        if (!cleanLoc) return;

        if (isScanningDestination && selectedItemToMove) {
            moveMutation.mutate({ id: selectedItemToMove.id, newLocation: cleanLoc });
        } else {
            setScannedLocation(cleanLoc);
        }
        setManualInput('');
        setShowManualInput(false);
    };

    const handleItemTap = (item) => {
        if (mode === 'SELL') {
            if (item.stock > 0) {
                sellMutation.mutate(item.id);
            } else {
                showToast('Stok Kosong!', 'error');
            }
        } else if (mode === 'MOVE') {
            setSelectedItemToMove(item);
            setIsScanningDestination(true);
            setCameraActive(true);
        }
    };

    const handleScanAgain = () => {
        setScannedLocation(null);
        setSelectedItemToMove(null);
        setIsScanningDestination(false);
        setCameraActive(true);
    };

    const resetScan = () => {
        stopScanner();
        setScannedLocation(null);
        setSelectedItemToMove(null);
        setIsScanningDestination(false);
        setCameraActive(false);
        setCameraError(null);
        setShowManualInput(false);
    };

    // ─── Pesan error kamera ─────────────────────────────────────────────────
    const cameraErrorMessages = {
        BLOCKED: 'Izin kamera diblokir. Buka Settings browser → Site permissions → Camera → Izinkan.',
        NOT_FOUND: 'Kamera tidak ditemukan di perangkat ini.',
        IN_USE: 'Kamera sedang digunakan oleh aplikasi lain.',
        UNKNOWN: 'Gagal mengakses kamera. Pastikan tidak ada aplikasi lain yang menggunakan kamera.',
        START_FAILED: 'Gagal memulai scanner. Coba refresh halaman.',
        DOM_ERROR: 'Elemen scanner tidak ditemukan. Coba refresh halaman.',
    };

    // ─── Tampilan saat kamera belum dinyalakan (Idle State) ─────────────────
    const renderIdleState = () => (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            {/* Error Display */}
            {cameraError && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-left w-full max-w-[300px]"
                >
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-xs font-mono text-red-400 leading-relaxed">
                            {cameraErrorMessages[cameraError] || 'Error tidak dikenal.'}
                        </p>
                    </div>
                </motion.div>
            )}

            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mb-6"
            >
                <div className="w-24 h-24 rounded-full bg-white/5 border-2 border-dashed border-white/20 flex items-center justify-center mx-auto">
                    <CameraOff className="w-10 h-10 text-gray-500" />
                </div>
            </motion.div>
            <h3 className="font-mono text-sm text-gray-400 mb-2">KAMERA TIDAK AKTIF</h3>
            <p className="text-xs text-gray-600 font-mono mb-6 max-w-[250px]">
                Tekan tombol di bawah untuk menyalakan kamera dan memindai QR Code lokasi.
            </p>

            <div className="flex flex-col gap-3 w-full max-w-[280px]">
                <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleActivateCamera}
                    className={`px-6 py-4 rounded-2xl font-mono font-bold text-sm flex items-center justify-center gap-3 transition-all border shadow-lg w-full
                        ${mode === 'SELL'
                            ? 'text-[var(--color-neon-cyan)] border-[var(--color-neon-cyan)]/40 bg-[var(--color-neon-cyan)]/10 hover:shadow-[0_0_30px_rgba(0,243,255,0.3)]'
                            : 'text-[var(--color-neon-purple)] border-[var(--color-neon-purple)]/40 bg-[var(--color-neon-purple)]/10 hover:shadow-[0_0_30px_rgba(188,19,254,0.3)]'
                        }`}
                >
                    <Camera className="w-5 h-5" />
                    📷 AKTIFKAN KAMERA
                </motion.button>

                <button
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="px-4 py-3 rounded-xl font-mono text-xs text-gray-400 border border-white/10 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                    <Keyboard className="w-4 h-4" />
                    KETIK LOKASI MANUAL
                </button>
            </div>

            {/* Fallback Manual Input */}
            <AnimatePresence>
                {showManualInput && (
                    <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleManualSubmit}
                        className="mt-4 w-full max-w-[280px]"
                    >
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={manualInput}
                                onChange={e => setManualInput(e.target.value)}
                                placeholder="Ketik nama lokasi..."
                                autoFocus
                                className="flex-1 bg-white/5 border border-white/20 rounded-lg px-3 py-3 text-white font-mono text-sm placeholder-gray-600 focus:outline-none focus:border-[var(--color-neon-cyan)]/50"
                            />
                            <button
                                type="submit"
                                disabled={!manualInput.trim()}
                                className="px-4 py-3 bg-[var(--color-neon-cyan)]/20 border border-[var(--color-neon-cyan)]/40 rounded-lg text-[var(--color-neon-cyan)] font-mono font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                GO
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>
        </div>
    );

    // ─── Tampilan saat kamera aktif (Scanning State) ────────────────────────
    const renderScanningState = () => (
        <div className="flex-1 flex flex-col">
            <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
                <div className="text-center flex-1">
                    <h3 className="font-mono text-sm text-white flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        {isScanningDestination ? 'SCAN KOTAK TUJUAN' : 'SCAN KOTAK SUMBER'}
                    </h3>
                    {isScanningDestination && selectedItemToMove && (
                        <p className="text-xs text-[var(--color-neon-purple)] mt-1">
                            Memindahkan: {selectedItemToMove.name}
                        </p>
                    )}
                </div>
                <button 
                    onClick={resetScan}
                    className="p-2 bg-white/5 hover:bg-red-500/20 rounded-full transition-colors"
                    title="Matikan Kamera"
                >
                    <CameraOff className="w-4 h-4 text-gray-400 hover:text-red-400" />
                </button>
            </div>
            <div className="flex-1 p-2 bg-black flex items-center justify-center relative min-h-[300px]">
                <div id="reader" className="w-full max-w-[320px]" style={{ minHeight: '300px' }}></div>
            </div>
        </div>
    );

    // ─── Tampilan daftar barang setelah scan berhasil ────────────────────────
    const renderItemList = () => (
        <div className="flex-1 flex flex-col max-h-[60vh]">
            <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center shrink-0">
                <div>
                    <p className="text-[10px] text-gray-500 font-mono">LOCATION SCANNED</p>
                    <h2 className="text-lg font-black tracking-widest text-[var(--color-neon-cyan)]">
                        {scannedLocation}
                    </h2>
                </div>
                <div className="flex gap-2">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={handleScanAgain}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-mono text-gray-300"
                    >
                        <ScanLine className="w-4 h-4" />
                        SCAN LAGI
                    </motion.button>
                    <button 
                        onClick={resetScan}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoading ? (
                    <div className="text-center py-8">
                        <RefreshCw className="w-6 h-6 text-gray-500 animate-spin mx-auto mb-2" />
                    </div>
                ) : locationItems.length === 0 ? (
                    <div className="text-center py-8 font-mono text-sm text-gray-500">
                        <Box className="w-8 h-8 opacity-50 mx-auto mb-2" />
                        Kotak Kosong
                    </div>
                ) : (
                    locationItems.map(item => (
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            key={item.id}
                            onClick={() => handleItemTap(item)}
                            disabled={sellMutation.isPending || moveMutation.isPending}
                            className={`w-full text-left p-4 rounded-xl border flex justify-between items-center transition-all shadow-lg
                                ${mode === 'SELL' 
                                    ? 'bg-black border-[var(--color-neon-cyan)]/30 hover:border-[var(--color-neon-cyan)]' 
                                    : 'bg-black border-[var(--color-neon-purple)]/30 hover:border-[var(--color-neon-purple)]'
                                }
                            `}
                        >
                            <div>
                                <h4 className="font-bold text-white text-base">{item.name}</h4>
                                <p className="text-xs font-mono mt-1 text-gray-400">
                                    {item.sub_bab || item.category}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className={`text-2xl font-black font-mono ${item.stock > 0 ? 'text-white' : 'text-red-500'}`}>
                                    {item.stock}
                                </p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Sisa Stok</p>
                            </div>
                        </motion.button>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div className="max-w-md mx-auto space-y-4 pb-20 relative min-h-[calc(100vh-80px)]">
            
            {/* Header / Toggle */}
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 p-2 rounded-2xl flex relative shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                <div 
                    className="absolute inset-y-2 w-[calc(50%-8px)] rounded-xl bg-white/10 transition-all duration-300"
                    style={{ 
                        left: mode === 'SELL' ? '8px' : 'calc(50%)',
                        borderBottom: `2px solid ${mode === 'SELL' ? 'var(--color-neon-cyan)' : 'var(--color-neon-purple)'}`
                    }}
                />
                
                <button 
                    onClick={() => { setMode('SELL'); resetScan(); }}
                    className={`flex-1 py-3 text-sm font-mono font-bold z-10 transition-colors flex items-center justify-center gap-2 ${mode === 'SELL' ? 'text-[var(--color-neon-cyan)]' : 'text-gray-500'}`}
                >
                    <Package className="w-4 h-4" /> 📦 JUAL
                </button>
                <button 
                    onClick={() => { setMode('MOVE'); resetScan(); }}
                    className={`flex-1 py-3 text-sm font-mono font-bold z-10 transition-colors flex items-center justify-center gap-2 ${mode === 'MOVE' ? 'text-[var(--color-neon-purple)]' : 'text-gray-500'}`}
                >
                    <ArrowRightLeft className="w-4 h-4" /> 🔄 PINDAH
                </button>
            </div>

            {/* Main Content Area */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col min-h-[400px]">
                {scannedLocation && !isScanningDestination ? (
                    renderItemList()
                ) : cameraActive ? (
                    renderScanningState()
                ) : (
                    renderIdleState()
                )}
            </div>

            {/* Toast Notification */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50, x: '-50%' }}
                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                        exit={{ opacity: 0, y: 50, x: '-50%' }}
                        className={`fixed bottom-24 left-1/2 px-4 py-3 rounded-xl border font-mono text-sm font-bold flex items-center gap-2 shadow-2xl z-50 whitespace-nowrap
                            ${toast.type === 'success' 
                                ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-400' 
                                : 'bg-red-900/90 border-red-500/50 text-red-400'
                            }`}
                    >
                        {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <X className="w-5 h-5" />}
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
