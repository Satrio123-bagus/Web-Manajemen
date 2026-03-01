import { useState, useEffect, useRef } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertTriangle, AlertCircle, Info, X, Check } from 'lucide-react';
import { useSound } from '../hooks/useSound';

const TYPE_CONFIG = {
    critical: {
        icon: AlertCircle,
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        dot: 'bg-red-500',
        glow: 'shadow-[0_0_8px_rgba(239,68,68,0.3)]',
    },
    warning: {
        icon: AlertTriangle,
        color: 'text-amber-400',
        bg: 'bg-amber-400/10',
        border: 'border-amber-400/30',
        dot: 'bg-amber-400',
        glow: 'shadow-[0_0_8px_rgba(251,191,36,0.3)]',
    },
    info: {
        icon: Info,
        color: 'text-[var(--color-neon-cyan)]',
        bg: 'bg-[var(--color-neon-cyan)]/10',
        border: 'border-[var(--color-neon-cyan)]/30',
        dot: 'bg-[var(--color-neon-cyan)]',
        glow: 'shadow-[0_0_8px_rgba(0,243,255,0.3)]',
    },
};

export default function NotificationPanel() {
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const panelRef = useRef(null);

    const { playSound } = useSound();

    // Fetch notifications
    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();

                // Play sound if there are new unread notifications that we didn't have before
                const currentUnread = notifications.filter(n => !n.read).length;
                const newUnread = data.filter(n => !n.read).length;

                if (newUnread > currentUnread && currentUnread !== 0) {
                    // Only play sound for subsequent new notifications, not on first load
                    playSound('bell');
                }

                setNotifications(data);
            }
        } catch { /* silent */ }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    // Close on click outside
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = async (id) => {
        try {
            await fetch('/api/notifications/read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, read: true } : n)
            );
        } catch { /* silent */ }
    };

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell button */}
            <button
                onClick={() => { playSound('click'); setIsOpen(!isOpen); }}
                className="relative p-2 rounded-lg text-gray-500 hover:text-[var(--color-neon-cyan)] hover:bg-white/5 transition-all"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[9px] font-bold font-mono bg-red-500 text-white rounded-full shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                    >
                        {unreadCount}
                    </motion.span>
                )}
            </button>

            {/* Dropdown panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-12 w-80 max-h-[420px] bg-[#0a0a0e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden z-50"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                            <div className="flex items-center gap-2">
                                <Bell className="w-4 h-4 text-[var(--color-neon-cyan)]" />
                                <span className="text-xs font-mono tracking-widest text-gray-400 uppercase">
                                    ALERTS
                                </span>
                                {unreadCount > 0 && (
                                    <span className="text-[9px] font-mono text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                                        {unreadCount} NEW
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 text-gray-600 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Notification list */}
                        <div className="overflow-y-auto max-h-[340px] p-2 space-y-1.5">
                            {notifications.length === 0 ? (
                                <p className="text-xs font-mono text-gray-600 text-center py-8">
                                    ALL_SYSTEMS_NOMINAL
                                </p>
                            ) : (
                                notifications.map((notif) => {
                                    const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.info;
                                    const Icon = config.icon;
                                    return (
                                        <motion.div
                                            key={notif.id}
                                            layout
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: notif.read ? 0.5 : 1, x: 0 }}
                                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer group
                                                ${notif.read
                                                    ? 'bg-white/[0.01] border-white/[0.03]'
                                                    : `${config.bg} ${config.border} ${config.glow}`
                                                }`}
                                            onClick={() => {
                                                if (!notif.read) {
                                                    playSound('click');
                                                    markAsRead(notif.id);
                                                }
                                            }}
                                        >
                                            <div className={`p-1.5 rounded-lg ${config.bg} shrink-0 mt-0.5`}>
                                                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={`text-[10px] font-mono tracking-wider font-bold ${config.color}`}>
                                                        {notif.title}
                                                    </span>
                                                    {!notif.read && (
                                                        <Check className="w-3 h-3 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed truncate">
                                                    {notif.message}
                                                </p>
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
