import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PackageOpen, Wrench, CheckCircle, AlertTriangle, Send, Plus, ArrowRight, Save, X, Archive, ArrowUpRight } from 'lucide-react';
import api from '../api';
import { useSound } from '../hooks/useSound';

const COLUMNS = [
    { id: 'MENTAH', title: 'KARUNG MENTAH', icon: PackageOpen, color: 'text-gray-400', border: 'border-gray-500/30', bg: 'bg-gray-500/10' },
    { id: 'GUDANG_CUCI', title: 'GUDANG CUCI', icon: Archive, color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10' },
    { id: 'GUDANG_CAT', title: 'GUDANG CAT', icon: Archive, color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
    { id: 'PROSES_CUCI', title: 'PROSES CUCI', icon: Wrench, color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
    { id: 'PROSES_CAT', title: 'PROSES CAT', icon: Wrench, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
    { id: 'QC_CEK', title: 'QC CEK', icon: CheckCircle, color: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10' },
    { id: 'SELESAI_JUAL', title: 'ETALASE JUAL', icon: ArrowUpRight, color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
    { id: 'SELESAI_RAKIT', title: 'ANTREAN RAKIT', icon: Archive, color: 'text-emerald-500', border: 'border-emerald-600/30', bg: 'bg-emerald-600/10' },
    { id: 'RUSAK', title: 'RUSAK', icon: AlertTriangle, color: 'text-red-400', border: 'border-red-500/30', bg: 'bg-red-500/10' }
];

export default function ProductionBoard({ user }) {
    const [jobs, setJobs] = useState([]);
    const [reports, setReports] = useState([]);
    const [reportText, setReportText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const { playSound } = useSound();

    // Admin form state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newJob, setNewJob] = useState({ tipe_remote: '', komponen: 'CASING', kriteria: '', alokasi: 1, supplier: 'Campuran (Lama)' });

    // QC Check popup state
    const [qcJob, setQcJob] = useState(null); // The job currently in QC check popup
    const [qcJual, setQcJual] = useState(0);
    const [qcRakit, setQcRakit] = useState(0);
    const [qcRusak, setQcRusak] = useState(0);

    // Sortir popup state
    const [sortirJob, setSortirJob] = useState(null);
    const [sortirCuci, setSortirCuci] = useState(0);
    const [sortirCat, setSortirCat] = useState(0);

    // Feed State
    const [activeTab, setActiveTab] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Tarik Parsial popup state
    const [tarikJob, setTarikJob] = useState(null);
    const [tarikJumlah, setTarikJumlah] = useState(0);
    const [tarikTargetStatus, setTarikTargetStatus] = useState('');

    // Afkir popup state
    const [afkirJob, setAfkirJob] = useState(null);
    const [afkirJumlah, setAfkirJumlah] = useState(0);
    const [afkirCatatan, setAfkirCatatan] = useState('');

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // polling setiap 10 detik
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [resJobs, resSupplies] = await Promise.all([
                api.get('/production/jobs'),
                api.get('/production/supplies')
            ]);
            
            if (resJobs.ok) {
                const data = await resJobs.json();
                setJobs(data.jobs);
            }
            if (resSupplies.ok) {
                const data = await resSupplies.json();
                setReports(data.reports);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddJob = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/production/jobs', newJob);
            if (res.ok) {
                playSound('success');
                fetchData();
                setShowAddForm(false);
                setNewJob({ tipe_remote: '', komponen: 'CASING', kriteria: '', alokasi: 1, supplier: 'Campuran (Lama)' });
            }
        } catch (error) {
            playSound('error');
        }
    };

    const handleMoveJob = async (jobId, newStatus) => {
        try {
            playSound('click');
            // Optimistic update
            setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus } : j));
            await api.put(`/production/jobs/${jobId}`, { status: newStatus });
            fetchData();
        } catch (error) {
            playSound('error');
            fetchData(); // revert on fail
        }
    };

    const handleQcSubmit = async () => {
        if (!qcJob) return;
        playSound('click');
        try {
            await api.post(`/production/jobs/${qcJob.id}/qc`, { 
                qcJual, 
                qcRakit, 
                qcRusak 
            });
            setQcJob(null);
            fetchData();
        } catch (err) {
            playSound('error');
        }
    };

    const handleSortirSubmit = async () => {
        if (!sortirJob) return;
        playSound('click');
        try {
            await api.post(`/production/jobs/${sortirJob.id}/sortir`, { 
                sortirCuci, 
                sortirCat 
            });
            setSortirJob(null);
            fetchData();
        } catch (err) {
            playSound('error');
        }
    };

    const handleTarikSubmit = async () => {
        if (!tarikJob || tarikJumlah <= 0 || tarikJumlah > tarikJob.alokasi) return;
        playSound('click');
        try {
            await api.post(`/production/jobs/${tarikJob.id}/tarik`, { 
                jumlah: tarikJumlah, 
                targetStatus: tarikTargetStatus 
            });
            setTarikJob(null);
            fetchData();
        } catch (err) {
            playSound('error');
        }
    };

    const handleAfkirSubmit = async () => {
        if (!afkirJob || afkirJumlah <= 0 || afkirJumlah > afkirJob.alokasi) return;
        playSound('click');
        try {
            await api.post(`/production/jobs/${afkirJob.id}/afkir`, { 
                jumlahRusak: afkirJumlah, 
                catatan: afkirCatatan 
            });
            setAfkirJob(null);
            fetchData();
        } catch (err) {
            playSound('error');
        }
    };

    const handleTutupBuku = async () => {
        if (!confirm('AWAS! Anda akan mengompres data dan MENGHAPUS SEMUA KARTU di kolom Selesai/Rusak. Lanjutkan?')) return;
        try {
            playSound('click');
            const res = await api.post('/production/tutup-buku');
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                fetchData();
            }
        } catch (err) {
            playSound('error');
            console.error(err);
        }
    };

    const sendReport = async () => {
        if (!reportText.trim()) return;
        try {
            playSound('click');
            const res = await api.post('/production/supplies', {
                pekerja: user.username,
                laporan: reportText
            });
            if (res.ok) {
                setReportText('');
                fetchData();
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Filter jobs based on role, tab, and search
    const filteredJobs = jobs.filter(job => {
        // Role filter
        if (user?.role === 'CASING' && job.komponen !== 'CASING') return false;
        if (user?.role === 'MESIN' && job.komponen !== 'MESIN' && job.komponen !== 'LAYAR') return false;
        
        // Tab filter
        if (activeTab !== 'ALL' && job.status !== activeTab) return false;

        // Search filter
        if (searchQuery && !job.tipe_remote.toLowerCase().includes(searchQuery.toLowerCase())) return false;

        return true;
    });

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-neon-cyan)] to-blue-500 uppercase">
                        Micro-Factory Board
                    </h1>
                    <p className="text-gray-400 font-mono text-sm mt-1 uppercase">
                        Divisi: {user?.role || 'ALL'}
                    </p>
                </div>
                {user?.role === 'ADMIN' && (
                    <div className="flex gap-2">
                        <button
                            onClick={handleTutupBuku}
                            className="flex items-center gap-2 bg-red-500/20 text-red-400 px-4 py-2 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all border border-red-500/50"
                        >
                            <Archive className="w-4 h-4" />
                            TUTUP BUKU
                        </button>
                        <button
                            onClick={() => setShowAddForm(!showAddForm)}
                            className="flex items-center gap-2 bg-[var(--color-neon-cyan)]/20 text-[var(--color-neon-cyan)] px-4 py-2 rounded-xl font-bold hover:bg-[var(--color-neon-cyan)] hover:text-black transition-all border border-[var(--color-neon-cyan)]/50"
                        >
                            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {showAddForm ? 'TUTUP' : 'INPUT KARUNG MENTAH'}
                        </button>
                    </div>
                )}
            </header>

            {/* Admin Input Form */}
            <AnimatePresence>
                {showAddForm && (
                    <motion.form 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleAddJob} 
                        className="bg-black/50 border border-[var(--color-neon-cyan)]/30 p-6 rounded-2xl grid grid-cols-1 md:grid-cols-5 gap-4 overflow-hidden"
                    >
                        <div className="space-y-1">
                            <label className="text-[10px] font-mono text-gray-400">TIPE REMOTE</label>
                            <input required value={newJob.tipe_remote} onChange={e => setNewJob({...newJob, tipe_remote: e.target.value})} type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono text-sm" placeholder="Contoh: A75C2656" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-mono text-gray-400">KOMPONEN</label>
                            <select value={newJob.komponen} onChange={e => setNewJob({...newJob, komponen: e.target.value})} className="w-full bg-[#111] border border-white/10 rounded-lg p-2 text-white font-mono text-sm">
                                <option>CASING</option>
                                <option>MESIN</option>
                                <option>LAYAR</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-mono text-gray-400">KRITERIA</label>
                            <input value={newJob.kriteria} onChange={e => setNewJob({...newJob, kriteria: e.target.value})} type="text" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono text-sm" placeholder="Contoh: Baut / Non-Baut" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-mono text-gray-400">SUPPLIER</label>
                            <select value={newJob.supplier} onChange={e => setNewJob({...newJob, supplier: e.target.value})} className="w-full bg-[#111] border border-[var(--color-neon-cyan)]/30 rounded-lg p-2 text-[var(--color-neon-cyan)] font-mono text-sm font-bold">
                                <option value="Campuran (Lama)">Campuran (Lama)</option>
                                <option value="Aziz">Aziz</option>
                                <option value="Komeng">Komeng</option>
                                <option value="Wakil">Wakil</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-mono text-gray-400">JUMLAH (PCS)</label>
                            <input required value={newJob.alokasi} onChange={e => setNewJob({...newJob, alokasi: parseInt(e.target.value)})} type="number" min="1" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white font-mono text-sm" />
                        </div>
                        <div className="flex items-end">
                            <button type="submit" className="w-full h-[42px] bg-[var(--color-neon-cyan)] text-black font-bold rounded-lg hover:shadow-[0_0_15px_rgba(0,243,255,0.5)] transition-all flex items-center justify-center gap-2">
                                <Save className="w-4 h-4" /> SIMPAN
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            {/* Smart Navigation & Search */}
            <div className="bg-[#111] border border-white/10 rounded-2xl p-4 sticky top-4 z-40 shadow-xl space-y-4">
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="🔍 Cari tipe remote (misal: A75C)..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[var(--color-neon-cyan)] transition-colors text-lg font-bold shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                    />
                </div>
                
                {/* Horizontal Scrollable Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <button 
                        onClick={() => setActiveTab('ALL')}
                        className={`flex-shrink-0 px-4 py-2 rounded-full font-bold text-xs transition-all border ${activeTab === 'ALL' ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}
                    >
                        SEMUA TUGAS
                    </button>
                    {COLUMNS.map(col => {
                        const count = jobs.filter(j => j.status === col.id).length;
                        return (
                            <button 
                                key={col.id}
                                onClick={() => setActiveTab(col.id)}
                                className={`flex-shrink-0 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 transition-all border ${activeTab === col.id ? `${col.bg} ${col.border} ${col.color}` : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}
                            >
                                <col.icon className="w-3 h-3" />
                                {col.title}
                                <span className="bg-black/50 px-1.5 rounded-md">{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* Vertical Task Feed (Takes 3 columns on large screens) */}
                <div className="lg:col-span-3 space-y-3 pb-20">
                    {filteredJobs.length === 0 ? (
                        <div className="bg-black/40 border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-gray-500 shadow-lg">
                            <Archive className="w-12 h-12 mb-4 opacity-20" />
                            <p className="font-mono text-sm">TIDAK ADA TUGAS DITEMUKAN</p>
                        </div>
                    ) : (
                        filteredJobs.map(job => {
                            const colConfig = COLUMNS.find(c => c.id === job.status) || COLUMNS[0];
                            const Icon = colConfig.icon;

                            return (
                                <motion.div layoutId={job.id} key={job.id} className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4 hover:border-white/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group shadow-md hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${colConfig.bg} ${colConfig.border} border shadow-inner`}>
                                            <Icon className={`w-6 h-6 ${colConfig.color}`} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-black text-white text-lg tracking-wider">{job.tipe_remote}</h4>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider
                                                    ${job.komponen === 'CASING' ? 'bg-blue-500/20 text-blue-400' : 
                                                    job.komponen === 'MESIN' ? 'bg-purple-500/20 text-purple-400' : 
                                                    'bg-emerald-500/20 text-emerald-400'}`}
                                                >
                                                    {job.komponen}
                                                </span>
                                                {job.supplier && (
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${job.supplier === 'Campuran (Lama)' ? 'bg-gray-500/20 text-gray-400' : 'bg-green-500/20 text-green-400'}`}>
                                                        🏭 {job.supplier}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                                <span className={`${colConfig.color} font-bold flex items-center gap-1`}>
                                                    • {colConfig.title}
                                                </span>
                                                <span className="text-gray-400 font-mono bg-black/50 border border-white/5 px-2 py-0.5 rounded-md">{job.alokasi} pcs</span>
                                                {job.kriteria && <span className="text-gray-400 italic">📝 {job.kriteria}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Action Buttons based on status */}
                                    <div className="flex flex-wrap sm:flex-nowrap gap-2 mt-2 sm:mt-0 min-w-max">
                                        {job.status === 'MENTAH' && (
                                            <button onClick={() => { setSortirJob(job); setSortirCuci(0); setSortirCat(0); }} className="w-full sm:w-auto px-4 py-2.5 text-xs bg-gray-500/10 text-gray-300 rounded-lg font-bold hover:bg-gray-500/30 hover:text-white transition-colors border border-gray-500/30">
                                                BONGKAR & SORTIR
                                            </button>
                                        )}
                                        {job.status === 'GUDANG_CUCI' && (
                                            <button onClick={() => { setTarikJob(job); setTarikJumlah(job.alokasi); setTarikTargetStatus('PROSES_CUCI'); }} className="w-full sm:w-auto px-4 py-2.5 text-xs bg-cyan-500/10 text-cyan-400 rounded-lg font-bold hover:bg-cyan-500/30 hover:text-cyan-300 transition-colors border border-cyan-500/30">
                                                TARIK KE CUCI
                                            </button>
                                        )}
                                        {job.status === 'GUDANG_CAT' && (
                                            <button onClick={() => { setTarikJob(job); setTarikJumlah(job.alokasi); setTarikTargetStatus('PROSES_CAT'); }} className="w-full sm:w-auto px-4 py-2.5 text-xs bg-orange-500/10 text-orange-400 rounded-lg font-bold hover:bg-orange-500/30 hover:text-orange-300 transition-colors border border-orange-500/30">
                                                TARIK KE CAT
                                            </button>
                                        )}
                                        {job.status === 'PROSES_CUCI' && (
                                            <>
                                                <button onClick={() => { setAfkirJob(job); setAfkirJumlah(0); setAfkirCatatan(''); }} className="w-full sm:w-auto px-4 py-2.5 text-xs bg-red-500/10 text-red-400 rounded-lg font-bold hover:bg-red-500/30 hover:text-red-300 transition-colors border border-red-500/30">
                                                    LAPOR RUSAK ⚠️
                                                </button>
                                                <button onClick={() => handleMoveJob(job.id, 'QC_CEK')} className="w-full sm:w-auto px-4 py-2.5 text-xs bg-blue-500/10 text-blue-400 rounded-lg font-bold hover:bg-blue-500/30 hover:text-blue-300 transition-colors border border-blue-500/30">
                                                    SELESAI (KE QC)
                                                </button>
                                            </>
                                        )}
                                        {job.status === 'PROSES_CAT' && (
                                            <>
                                                <button onClick={() => { setAfkirJob(job); setAfkirJumlah(0); setAfkirCatatan(''); }} className="w-full sm:w-auto px-4 py-2.5 text-xs bg-red-500/10 text-red-400 rounded-lg font-bold hover:bg-red-500/30 hover:text-red-300 transition-colors border border-red-500/30">
                                                    LAPOR RUSAK ⚠️
                                                </button>
                                                <button onClick={() => handleMoveJob(job.id, 'QC_CEK')} className="w-full sm:w-auto px-4 py-2.5 text-xs bg-amber-500/10 text-amber-400 rounded-lg font-bold hover:bg-amber-500/30 hover:text-amber-300 transition-colors border border-amber-500/30">
                                                    SELESAI (KE QC)
                                                </button>
                                            </>
                                        )}
                                        {job.status === 'QC_CEK' && (
                                            <button onClick={() => { setQcJob(job); setQcJual(0); setQcRakit(0); setQcRusak(0); }} className="w-full sm:w-auto px-4 py-2.5 text-xs bg-[var(--color-neon-cyan)]/10 text-[var(--color-neon-cyan)] rounded-lg font-bold hover:bg-[var(--color-neon-cyan)]/30 hover:text-white transition-colors border border-[var(--color-neon-cyan)]/30 shadow-[0_0_10px_rgba(0,243,255,0.1)]">
                                                ALOKASI QC
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </div>

                {/* Supply Reports Side Panel */}
                <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden flex flex-col h-[70vh]">
                    <div className="p-4 border-b border-white/10 bg-white/5">
                        <h3 className="font-black tracking-widest text-white flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                            SUPPLY NOTES
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {reports.map(report => (
                            <div key={report.id} className="bg-white/5 rounded-xl p-3 border border-white/5">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-gray-300">@{report.pekerja}</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${report.status === 'RESOLVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                        {report.status}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-400">{report.laporan}</p>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-white/10 bg-white/5">
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={reportText}
                                onChange={e => setReportText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && sendReport()}
                                placeholder="Lapor barang habis..." 
                                className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[var(--color-neon-cyan)]"
                            />
                            <button onClick={sendReport} className="bg-[var(--color-neon-cyan)]/20 text-[var(--color-neon-cyan)] p-2 rounded-lg hover:bg-[var(--color-neon-cyan)] hover:text-black transition-colors">
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sortir Modal */}
            <AnimatePresence>
                {sortirJob && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#111] border border-white/20 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-gray-500/10">
                                <h3 className="font-black text-gray-300 tracking-wider">BONGKAR KARUNG (Total: {sortirJob.alokasi})</h3>
                                <button onClick={() => setSortirJob(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <label className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                                        MASUK GUDANG CUCI (Mulus) 🌧️
                                    </label>
                                    <input type="number" min="0" max={sortirJob.alokasi} value={sortirCuci} onChange={e => setSortirCuci(parseInt(e.target.value) || 0)} className="w-full bg-white/5 border border-cyan-500/30 rounded-lg p-3 text-cyan-400 font-mono text-lg text-center focus:border-cyan-400 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                                        MASUK GUDANG CAT (Baret) ☀️
                                    </label>
                                    <input type="number" min="0" max={sortirJob.alokasi} value={sortirCat} onChange={e => setSortirCat(parseInt(e.target.value) || 0)} className="w-full bg-white/5 border border-orange-500/30 rounded-lg p-3 text-orange-400 font-mono text-lg text-center focus:border-orange-400 focus:outline-none" />
                                </div>
                                
                                { (sortirCuci + sortirCat) !== Number(sortirJob.alokasi) ? (
                                    <div className="text-red-400 text-xs text-center font-bold">TOTAL HARUS PAS {sortirJob.alokasi}! (Input: {sortirCuci + sortirCat})</div>
                                ) : (
                                    <button onClick={handleSortirSubmit} className="w-full bg-gray-600 text-white font-bold py-3 rounded-lg hover:bg-gray-500 transition-colors">
                                        SIMPAN KE GUDANG
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* QC Allocation Modal */}
            <AnimatePresence>
                {qcJob && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#111] border border-white/20 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-blue-500/10">
                                <h3 className="font-black text-blue-400 tracking-wider">ALOKASI QC (Total: {qcJob.alokasi})</h3>
                                <button onClick={() => setQcJob(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <label className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                                        BAGUS - JUAL TERPISAH (ETALASE)
                                    </label>
                                    <input type="number" min="0" max={qcJob.alokasi} value={qcJual} onChange={e => setQcJual(parseInt(e.target.value) || 0)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-emerald-400 font-mono text-lg text-center" />
                                </div>
                                <div>
                                    <label className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                                        BAGUS - ANTREAN RAKIT UTUH
                                    </label>
                                    <input type="number" min="0" max={qcJob.alokasi} value={qcRakit} onChange={e => setQcRakit(parseInt(e.target.value) || 0)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-emerald-500 font-mono text-lg text-center" />
                                </div>
                                <div>
                                    <label className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                                        RUSAK / GAGAL
                                    </label>
                                    <input type="number" min="0" max={qcJob.alokasi} value={qcRusak} onChange={e => setQcRusak(parseInt(e.target.value) || 0)} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-red-400 font-mono text-lg text-center" />
                                </div>
                                
                                { (qcJual + qcRakit + qcRusak) !== Number(qcJob.alokasi) ? (
                                    <div className="text-red-400 text-xs text-center font-bold">TOTAL HARUS PAS {qcJob.alokasi}! (Total input saat ini: {qcJual + qcRakit + qcRusak})</div>
                                ) : (
                                    <button onClick={handleQcSubmit} className="w-full bg-blue-500 text-white font-bold py-3 rounded-lg hover:bg-blue-400 transition-colors">
                                        KONFIRMASI ALOKASI
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Tarik Parsial Modal */}
            <AnimatePresence>
                {tarikJob && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#111] border border-white/20 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                            <div className={`p-4 border-b border-white/10 flex justify-between items-center ${tarikTargetStatus === 'PROSES_CUCI' ? 'bg-cyan-500/10' : 'bg-orange-500/10'}`}>
                                <h3 className={`font-black tracking-wider ${tarikTargetStatus === 'PROSES_CUCI' ? 'text-cyan-400' : 'text-orange-400'}`}>TARIK KE PROSES (Max: {tarikJob.alokasi})</h3>
                                <button onClick={() => setTarikJob(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <label className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                                        JUMLAH YANG AKAN DIKERJAKAN
                                    </label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max={tarikJob.alokasi} 
                                        value={tarikJumlah} 
                                        onChange={e => setTarikJumlah(parseInt(e.target.value) || 0)} 
                                        className={`w-full bg-white/5 border rounded-lg p-3 font-mono text-lg text-center ${tarikTargetStatus === 'PROSES_CUCI' ? 'text-cyan-400 border-cyan-500/30' : 'text-orange-400 border-orange-500/30'}`} 
                                    />
                                </div>
                                
                                { (tarikJumlah <= 0 || tarikJumlah > tarikJob.alokasi) ? (
                                    <div className="text-red-400 text-xs text-center font-bold">JUMLAH TIDAK VALID!</div>
                                ) : (
                                    <button onClick={handleTarikSubmit} className={`w-full text-white font-bold py-3 rounded-lg transition-colors ${tarikTargetStatus === 'PROSES_CUCI' ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-orange-600 hover:bg-orange-500'}`}>
                                        TARIK SEKARANG
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Lapor Rusak (Afkir) Modal */}
            <AnimatePresence>
                {afkirJob && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#111] border border-white/20 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-red-500/10">
                                <h3 className="font-black text-red-400 tracking-wider flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4" /> LAPOR RUSAK (Max: {afkirJob.alokasi})
                                </h3>
                                <button onClick={() => setAfkirJob(null)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                                        JUMLAH BARANG RUSAK
                                    </label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max={afkirJob.alokasi} 
                                        value={afkirJumlah} 
                                        onChange={e => setAfkirJumlah(parseInt(e.target.value) || 0)} 
                                        className="w-full bg-white/5 border border-red-500/30 rounded-lg p-3 font-mono text-lg text-center text-red-400 focus:border-red-400 focus:outline-none" 
                                    />
                                </div>
                                <div>
                                    <label className="flex justify-between text-xs font-bold text-gray-400 mb-2">
                                        CATATAN KENDALA (Opsional)
                                    </label>
                                    <input 
                                        type="text" 
                                        value={afkirCatatan} 
                                        onChange={e => setAfkirCatatan(e.target.value)} 
                                        placeholder="Casing retak / tulisan pudar..."
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-400 focus:outline-none" 
                                    />
                                </div>
                                
                                { (afkirJumlah <= 0 || afkirJumlah > afkirJob.alokasi) ? (
                                    <div className="text-red-400 text-xs text-center font-bold">JUMLAH TIDAK VALID!</div>
                                ) : (
                                    <button onClick={handleAfkirSubmit} className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-500 transition-colors mt-2">
                                        BUANG KE TONG RUSAK
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}
