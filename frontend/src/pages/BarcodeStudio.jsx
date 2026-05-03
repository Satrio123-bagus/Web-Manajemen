import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { Download, Printer, Box, Layers, RefreshCw } from 'lucide-react';
import api from '../api';

export default function BarcodeStudio() {
    // Fetch all items to group them by location (sub_bab)
    const { data, isLoading } = useQuery({
        queryKey: ['items', 'all_for_barcode'],
        queryFn: async () => {
            const res = await api.get('/items?limit=5000'); // Get all items
            if (!res.ok) throw new Error('Gagal memuat inventori');
            const result = await res.json();
            return result.data || result;
        }
    });

    const qrRef = useRef(null);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-8 h-8 text-[var(--color-neon-cyan)] animate-spin" />
            </div>
        );
    }

    // Group items by sub_bab (which acts as Location/Kotak)
    const items = data || [];
    const locationGroups = items.reduce((acc, item) => {
        const loc = item.location && item.location.trim() !== '' && item.location !== 'Belum Ditentukan' ? item.location.toUpperCase() : 'BELUM DITENTUKAN';
        if (!acc[loc]) acc[loc] = [];
        acc[loc].push(item);
        return acc;
    }, {});

    const locations = Object.keys(locationGroups).sort();

    const handleDownload = async (locName) => {
        const element = document.getElementById(`qr-card-${locName}`);
        if (!element) return;
        
        // Temporarily adjust styles for a clean capture
        const originalStyle = element.getAttribute('style');
        element.style.background = '#ffffff';
        element.style.color = '#000000';
        element.style.padding = '40px';
        element.style.borderRadius = '0';
        
        try {
            const canvas = await html2canvas(element, { scale: 3, backgroundColor: '#ffffff' });
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `QR_${locName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
            link.href = dataUrl;
            link.click();
        } finally {
            if (originalStyle) element.setAttribute('style', originalStyle);
            else element.removeAttribute('style');
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-neon-cyan)] to-[var(--color-neon-purple)] drop-shadow-[0_0_8px_rgba(0,243,255,0.5)] flex items-center gap-2">
                        <Box className="w-6 h-6 text-white" />
                        QR STUDIO (WMS)
                    </h1>
                    <p className="text-sm font-mono text-gray-500 mt-1">
                        Cetak atau unduh stiker Barcode untuk kotak penyimpanan Anda.
                    </p>
                </div>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-mono font-bold transition-colors print:hidden"
                >
                    <Printer className="w-4 h-4" />
                    PRINT SEMUA (CTRL+P)
                </button>
            </div>

            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-container, .print-container * { visibility: visible; }
                    .print-container { position: absolute; left: 0; top: 0; width: 100%; display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
                    .no-print { display: none !important; }
                    .qr-card-print { break-inside: avoid; border: 1px solid #000; padding: 20px; color: #000 !important; background: #fff !important; }
                }
            `}</style>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print-container" ref={qrRef}>
                {locations.map((loc) => {
                    const boxItems = locationGroups[loc];
                    const totalStock = boxItems.reduce((sum, i) => sum + i.stock, 0);

                    return (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={loc}
                            id={`qr-card-${loc}`}
                            className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden group qr-card-print"
                        >
                            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-[var(--color-neon-cyan)] to-[var(--color-neon-purple)] opacity-50" />
                            
                            <h2 className="text-xl font-black tracking-widest text-white mb-6 uppercase no-print">
                                {loc}
                            </h2>
                            <h2 className="text-2xl font-black tracking-widest text-black mb-6 uppercase hidden print:block">
                                {loc}
                            </h2>

                            <div className="bg-white p-4 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-6">
                                <QRCodeCanvas 
                                    value={loc} 
                                    size={180} 
                                    level="H"
                                    includeMargin={true}
                                />
                            </div>

                            <div className="w-full text-left space-y-2 mb-6 no-print">
                                <div className="flex justify-between items-center text-xs font-mono text-gray-400">
                                    <span className="flex items-center gap-1"><Layers className="w-3 h-3"/> SKU Count:</span>
                                    <span className="text-white font-bold">{boxItems.length} Jenis</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-mono text-gray-400">
                                    <span className="flex items-center gap-1"><Box className="w-3 h-3"/> Total Fisik:</span>
                                    <span className="text-white font-bold">{totalStock} Unit</span>
                                </div>
                            </div>

                            <div className="hidden print:block w-full text-left mt-4 text-black text-sm font-mono">
                                <p>SKU Count: {boxItems.length} | Total Items: {totalStock}</p>
                            </div>

                            <button
                                onClick={() => handleDownload(loc)}
                                className="w-full py-2 bg-[var(--color-neon-cyan)]/10 hover:bg-[var(--color-neon-cyan)]/20 border border-[var(--color-neon-cyan)]/30 text-[var(--color-neon-cyan)] rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 no-print"
                            >
                                <Download className="w-4 h-4" />
                                SAVE TO GALLERY
                            </button>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
