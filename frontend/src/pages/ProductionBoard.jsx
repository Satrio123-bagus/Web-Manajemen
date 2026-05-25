import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PackageOpen, Wrench, CheckCircle, AlertTriangle, Send, Plus, ArrowRight, Save, X, Archive, ArrowUpRight } from 'lucide-react';
import api from '../api';
import { useSound } from '../hooks/useSound';

const COLUMNS = [
    { id: 'MENTAH', title: 'MENTAH', icon: PackageOpen, color: 'text-gray-400', border: 'border-gray-500/30', bg: 'bg-gray-500/10' },
    { id: 'PROSES', title: 'DIPROSES', icon: Wrench, color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
    { id: 'QC_CEK', title: 'QC CEK', icon: CheckCircle, color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
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
    const [newJob, setNewJob] = useState({ tipe_remote: '', komponen: 'CASING', kriteria: '', alokasi: 1 });

    // QC Check popup state
    const [qcJob, setQcJob] = useState(null); // The job currently in QC check popup
    const [qcJual, setQcJual] = useState(0);
    const [qcRakit, setQcRakit] = useState(0);
    const [qcRusak, setQcRusak] = useState(0);

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
                setNewJob({ tipe_remote: '', komponen: 'CASING', kriteria: '', alokasi: 1 });
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

    // Filter jobs based on role
    const filteredJobs = jobs.filter(job => {
        if (user?.role === 'ADMIN') return true;
        if (user?.role === 'CASING') return job.komponen === 'CASING';
        if (user?.role === 'MESIN') return job.komponen === 'MESIN' || job.komponen === 'LAYAR';
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
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="flex items-center gap-2 bg-[var(--color-neon-cyan)]/20 text-[var(--color-neon-cyan)] px-4 py-2 rounded-xl font-bold hover:bg-[var(--color-neon-cyan)] hover:text-black transition-all border border-[var(--color-neon-cyan)]/50"
                    >
                        {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showAddForm ? 'TUTUP' : 'INPUT KARUNG MENTAH'}
                    </button>
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                {/* Kanban Board Area (Takes 3 columns) */}
                <div className="lg:col-span-3 overflow-x-auto">
                    <div className="flex gap-4 min-w-max pb-4">
                        {COLUMNS.map(col => {
                            const colJobs = filteredJobs.filter(j => j.status === col.id);
                            const Icon = col.icon;
                            
                            return (
                                <div key={col.id} className={`w-72 flex-shrink-0 bg-black/40 border ${col.border} rounded-2xl overflow-hidden flex flex-col max-h-[70vh]`}>
                                    <div className={`p-4 border-b ${col.border} ${col.bg} flex items-center justify-between`}>
                                        <div className="flex items-center gap-2">
                                            <Icon className={`w-5 h-5 ${col.color}`} />
                                            <h3 className={`font-black tracking-widest ${col.color}`}>{col.title}</h3>
                                        </div>
                                        <span className="bg-black/50 px-2 py-0.5 rounded text-xs font-mono text-white">{colJobs.length}</span>
                                    </div>
                                    <div className="p-3 overflow-y-auto flex-1 space-y-3 min-h-[150px]">
                                        {colJobs.length === 0 && (
                                            <div className="h-full flex items-center justify-center text-gray-600 font-mono text-xs opacity-50">
                                                KOSONG
                                            </div>
                                        )}
                                        {colJobs.map(job => (
                                            <motion.div layoutId={job.id} key={job.id} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider
                                                        ${job.komponen === 'CASING' ? 'bg-blue-500/20 text-blue-400' : 
                                                          job.komponen === 'MESIN' ? 'bg-purple-500/20 text-purple-400' : 
                                                          'bg-emerald-500/20 text-emerald-400'}`}
                                                    >
                                                        {job.komponen}
                                                    </span>
                                                    <span className="text-[10px] font-mono text-gray-500">{job.alokasi} pcs</span>
                                                </div>
                                                <h4 className="font-bold text-white mb-1">{job.tipe_remote}</h4>
                                                {job.kriteria && <p className="text-xs text-gray-400 mb-3">{job.kriteria}</p>}
                                                
                                                {/* Action Buttons based on status */}
                                                <div className="pt-3 border-t border-white/5 flex gap-2">
                                                    {col.id === 'MENTAH' && (
                                                        <button onClick={() => handleMoveJob(job.id, 'PROSES')} className="flex-1 text-[10px] bg-amber-500/10 text-amber-500 py-1.5 rounded font-bold hover:bg-amber-500/20 transition-colors">
                                                            KERJAKAN
                                                        </button>
                                                    )}
                                                    {col.id === 'PROSES' && (
                                                        <button onClick={() => handleMoveJob(job.id, 'QC_CEK')} className="flex-1 text-[10px] bg-blue-500/10 text-blue-500 py-1.5 rounded font-bold hover:bg-blue-500/20 transition-colors">
                                                            SELESAI (KE QC)
                                                        </button>
                                                    )}
                                                    {col.id === 'QC_CEK' && (
                                                        <button onClick={() => { setQcJob(job); setQcJual(job.alokasi); setQcRakit(0); setQcRusak(0); }} className="flex-1 text-[10px] bg-[var(--color-neon-cyan)]/10 text-[var(--color-neon-cyan)] py-1.5 rounded font-bold hover:bg-[var(--color-neon-cyan)]/20 transition-colors">
                                                            ALOKASI QC
                                                        </button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
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
                                    <div className="text-red-400 text-xs text-center font-bold">TOTAL HARUS PAS {qcJob.alokasi}!</div>
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

        </div>
    );
}
