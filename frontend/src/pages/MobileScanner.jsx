import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CameraOff, Box, Package, ArrowRightLeft, X, CheckCircle, RefreshCw, ScanLine } from 'lucide-react';
import api from '../api';

export default function MobileScanner() {
    const [scannedLocation, setScannedLocation] = useState(null);
    const [mode, setMode] = useState('SELL'); // 'SELL' | 'MOVE'
    const [selectedItemToMove, setSelectedItemToMove] = useState(null);
    const [isScanningDestination, setIsScanningDestination] = useState(false);
    const [cameraActive, setCameraActive] = useState(false); // Kamera mati default
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
            setCameraActive(false); // Matikan kamera setelah pindah selesai
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

    // ─── Kamera hanya menyala jika cameraActive === true ────────────────────
    const startScanner = useCallback(() => {
        if (scannerRef.current) return;

        // Beri waktu DOM untuk render container #reader
        setTimeout(() => {
            const readerEl = document.getElementById('reader');
            if (!readerEl) return;

            const scanner = new Html5QrcodeScanner("reader", { 
                fps: 10, 
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                showTorchButtonIfSupported: true
            }, false);

            scanner.render((decodedText) => {
                const cleanLoc = decodedText.trim().toUpperCase();

                // Matikan kamera segera setelah scan berhasil
                scanner.clear().catch(() => {});
                scannerRef.current = null;
                setCameraActive(false);

                if (isScanningDestination && selectedItemToMove) {
                    moveMutation.mutate({ id: selectedItemToMove.id, newLocation: cleanLoc });
                } else {
                    setScannedLocation(cleanLoc);
                }
            }, () => {
                // Ignore — belum ada QR terdeteksi
            });

            scannerRef.current = scanner;
        }, 100);
    }, [isScanningDestination, selectedItemToMove, moveMutation]);

    const stopScanner = useCallback(() => {
        if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
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
        return () => stopScanner();
    }, [cameraActive, startScanner, stopScanner]);

    // Deteksi layar mati/tab berpindah → matikan kamera otomatis
    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden) {
                stopScanner();
                setCameraActive(false);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [stopScanner]);

    const handleActivateCamera = () => {
        setCameraActive(true);
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
            setCameraActive(true); // Nyalakan kamera untuk scan tujuan
        }
    };

    const handleScanAgain = () => {
        setScannedLocation(null);
        setSelectedItemToMove(null);
        setIsScanningDestination(false);
        setCameraActive(true); // Nyalakan kamera
    };

    const resetScan = () => {
        stopScanner();
        setScannedLocation(null);
        setSelectedItemToMove(null);
        setIsScanningDestination(false);
        setCameraActive(false);
    };

    // ─── Tampilan saat kamera belum dinyalakan (Idle State) ─────────────────
    const renderIdleState = () => (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
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
                Tekan tombol di bawah untuk menyalakan kamera dan mulai memindai QR Code lokasi.
            </p>
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleActivateCamera}
                className={`px-6 py-4 rounded-2xl font-mono font-bold text-sm flex items-center gap-3 transition-all border shadow-lg
                    ${mode === 'SELL'
                        ? 'text-[var(--color-neon-cyan)] border-[var(--color-neon-cyan)]/40 bg-[var(--color-neon-cyan)]/10 hover:shadow-[0_0_30px_rgba(0,243,255,0.3)]'
                        : 'text-[var(--color-neon-purple)] border-[var(--color-neon-purple)]/40 bg-[var(--color-neon-purple)]/10 hover:shadow-[0_0_30px_rgba(188,19,254,0.3)]'
                    }`}
            >
                <Camera className="w-5 h-5" />
                📷 AKTIFKAN KAMERA
            </motion.button>
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
            <div className="flex-1 p-2 bg-black flex items-center justify-center relative">
                <div id="reader" className="w-full max-w-[300px] border-2 border-[var(--color-neon-cyan)] rounded-xl overflow-hidden shadow-[0_0_15px_rgba(0,243,255,0.2)]"></div>
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
