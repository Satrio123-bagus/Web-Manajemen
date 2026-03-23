import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, ServerCrash, KeyRound } from 'lucide-react';
import { useSound } from '../hooks/useSound';
import api from '../api';

export default function Login({ onLogin }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { playSound } = useSound();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        playSound('click');

        try {
            const res = await api.post('/auth/login', { password });

            const data = await res.json();

            if (!res.ok) {
                playSound('error');
                throw new Error(data.message || 'Akses Ditolak');
            }

            playSound('success');
            localStorage.setItem('cortex_token', data.token);
            onLogin(data.token);
            
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Grid & Glitch Effects */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,243,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,243,255,0.03)_1px,transparent_1px)] bg-[size:30px_30px] opacity-20" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] z-10" />

            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-black/80 backdrop-blur-xl border border-[var(--color-neon-cyan)]/30 rounded-2xl p-8 relative z-20 shadow-[0_0_50px_rgba(0,243,255,0.1)]"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-[var(--color-neon-cyan)]/10 text-[var(--color-neon-cyan)] rounded-xl mx-auto flex items-center justify-center mb-4 border border-[var(--color-neon-cyan)]/30 shadow-[0_0_20px_rgba(0,243,255,0.2)]">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-neon-cyan)] to-[var(--color-neon-purple)]">
                        INSERT3COINS
                    </h1>
                    <p className="text-xs font-mono tracking-[0.3em] text-[var(--color-neon-cyan)] mt-2 uppercase">
                        Restricted Access
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <KeyRound className="h-5 w-5 text-gray-500 group-focus-within:text-[var(--color-neon-cyan)] transition-colors" />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-11 pr-4 py-4 border border-white/10 rounded-xl bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--color-neon-cyan)] focus:bg-white/10 font-mono tracking-widest transition-all"
                                placeholder="ENTER PASSWORD"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-400 text-xs font-mono">
                            <ServerCrash className="w-4 h-4 shrink-0" />
                            {error}
                        </motion.div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full relative overflow-hidden group bg-[var(--color-neon-cyan)]/10 text-[var(--color-neon-cyan)] border border-[var(--color-neon-cyan)]/50 rounded-xl py-4 font-bold tracking-[0.2em] uppercase transition-all hover:bg-[var(--color-neon-cyan)] hover:text-black hover:shadow-[0_0_30px_rgba(0,243,255,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'AUTHENTICATING...' : 'INITIALIZE SYSTEM'}
                    </button>
                    <p className="text-center font-mono text-[10px] text-gray-600 tracking-widest mt-4">
                        CORTEX AI // ENCRYPTED CONNECTION
                    </p>
                </form>
            </motion.div>
        </div>
    );
}
