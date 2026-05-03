import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import { Download, Printer, Box, Layers, RefreshCw } from 'lucide-react';
import api from '../api';

export default function BarcodeStudio() {
    const { data, isLoading } = useQuery({
        queryKey: ['items', 'all_for_barcode'],
        queryFn: async () => {
            const res = await api.get('/items?limit=5000');
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

    const items = data || [];
    const locationGroups = items.reduce((acc, item) => {
        const loc = item.location && item.location.trim() !== '' && item.location !== 'Belum Ditentukan' ? item.location.toUpperCase() : 'BELUM DITENTUKAN';
        if (!acc[loc]) acc[loc] = [];
        acc[loc].push(item);
        return acc;
    }, {});

    const locations = Object.keys(locationGroups).sort();

    // ─── Download QR menggunakan Canvas API murni (tanpa html2canvas) ────────
    const handleDownload = (locName, skuCount, totalStock) => {
        // Ambil elemen <canvas> QR Code yang sudah dirender oleh qrcode.react
        const cardEl = document.getElementById(`qr-card-${locName}`);
        if (!cardEl) return;
        const qrCanvas = cardEl.querySelector('canvas');
        if (!qrCanvas) return;

        // Buat kanvas baru untuk menggambar stiker bersih berlatar putih
        const padding = 40;
        const qrSize = 250;
        const titleHeight = 60;
        const infoHeight = 50;
        const totalWidth = qrSize + padding * 2;
        const totalHeight = titleHeight + qrSize + infoHeight + padding * 2;

        const canvas = document.createElement('canvas');
        canvas.width = totalWidth * 2; // 2x resolusi untuk ketajaman cetak
        canvas.height = totalHeight * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);

        // Latar putih
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, totalWidth, totalHeight);

        // Border tipis
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(4, 4, totalWidth - 8, totalHeight - 8);

        // Judul lokasi (teks hitam tebal)
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(locName, totalWidth / 2, padding + 30);

        // Garis pemisah
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, titleHeight + padding - 10);
        ctx.lineTo(totalWidth - padding, titleHeight + padding - 10);
        ctx.stroke();

        // Gambar QR Code dari canvas asli
        const qrX = (totalWidth - qrSize) / 2;
        const qrY = titleHeight + padding;
        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

        // Info SKU dan total stok
        ctx.fillStyle = '#333333';
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        const infoY = qrY + qrSize + 25;
        ctx.fillText(`${skuCount} Jenis  •  ${totalStock} Unit`, totalWidth / 2, infoY);

        // Unduh file PNG
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `QR_${locName.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        link.href = dataUrl;
        link.click();
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
                                onClick={() => handleDownload(loc, boxItems.length, totalStock)}
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
