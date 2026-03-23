import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Database } from 'lucide-react';
import api from '../api';

const LOG_TYPE_STYLES = {
    CREATE: 'text-emerald-400',
    UPDATE: 'text-amber-400',
    DELETE: 'text-red-500',
    SELL: 'text-[var(--color-neon-cyan)]',
    RESTOCK: 'text-violet-400',
    DEFAULT: 'text-gray-500',
};

function formatTimestamp(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = String(date.getFullYear()).slice(-2);
    const time = date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    return `[${d}/${m}/${y} ${time}]`;
}

export default function ActivityLog() {
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState(null);
    const logContainerRef = useRef(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await api.get('/transactions/recent');
                if (!res.ok) {
                    throw new Error(`Network response was not ok: ${res.statusText}`);
                }
                const data = await res.json();
                setLogs(data);
            } catch (err) {
                setError(err.message);
                console.error("Failed to fetch logs:", err);
            }
        };

        fetchLogs(); // Initial fetch
        const intervalId = setInterval(fetchLogs, 5000); // Poll every 5 seconds

        return () => clearInterval(intervalId); // Cleanup on unmount
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    const renderLog = (log) => {
        const style = LOG_TYPE_STYLES[log.type] || LOG_TYPE_STYLES.DEFAULT;
        let message = `[${log.type}] ${log.item_name}`;

        switch (log.type) {
            case 'CREATE':
                message = `[CREATE] New item registered: "${log.item_name}"`;
                break;
            case 'UPDATE':
                message = `[UPDATE] Data for "${log.item_name}" was modified.`;
                break;
            case 'DELETE':
                message = `[DELETE] Item "${log.item_name}" deconstructed.`;
                break;
            case 'SELL':
                message = `[SELL] Sold ${log.quantity}x "${log.item_name}" for ${log.total.toLocaleString()} Rp`;
                break;
            case 'RESTOCK':
                message = `[RESTOCK] Received ${log.quantity}x "${log.item_name}"`;
                break;
            default:
                message = `[${log.type || 'SYSTEM'}] Event for "${log.item_name}"`;
        }

        return (
            <p className="font-mono text-xs leading-relaxed group/log">
                <span className="text-gray-600 mr-2 group-hover/log:text-[var(--color-neon-purple)] transition-colors">
                    {formatTimestamp(log.timestamp)}
                </span>
                <span className={`${style} transition-colors`}>{message}</span>
            </p>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="h-full"
        >
            <div className="h-full flex flex-col rounded-2xl border border-white/5 bg-[rgba(8,8,12,0.6)] backdrop-blur-xl overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 border-b border-white/5">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Database className="w-5 h-5 text-[var(--color-neon-purple)]" />
                        Transaction Log
                    </h3>
                    <p className="text-xs font-mono text-gray-600 mt-1">
                        Live feed of all data transactions
                    </p>
                </div>

                {/* Log container */}
                <div ref={logContainerRef} className="flex-1 p-5 space-y-3 overflow-y-auto">
                    {error && (
                        <p className="font-mono text-xs text-red-500">
                            [ERROR] Failed to connect to log stream: {error}
                        </p>
                    )}
                    {logs.length > 0 ? (
                        logs.map(log => (
                            <div key={log.transaction_id}>{renderLog(log)}</div>
                        ))
                    ) : (
                        <div className="py-8 text-center font-mono text-gray-600">
                            <p className="text-lg mb-1">LOG_STREAM: <span className="text-[var(--color-neon-cyan)]">AWAITING_DATA</span></p>
                            <p className="text-xs">No transactions recorded yet...</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-white/5 flex justify-between items-center">
                    <p className="text-[10px] font-mono text-gray-600 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                        LIVE_FEED
                    </p>
                    <p className="text-[10px] font-mono text-gray-600">
                        {logs.length} RECORDS
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
