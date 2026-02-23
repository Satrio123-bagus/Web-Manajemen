import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader, WifiOff, CheckCircle, AlertTriangle } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import Layout from './components/Layout';
import Dashboard, { InventoryModal } from './pages/Dashboard';
import DashboardHome from './pages/DashboardHome';
import Analytics from './pages/Analytics';
import Terminal from './pages/Terminal';
import Settings from './pages/Settings';

const API = '/api/items';

function AppContent() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeDeleteId, setActiveDeleteId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [toast, setToast] = useState(null);

  const location = useLocation();

  // Derive activePage from URL
  const activePage = location.pathname === '/' ? 'dashboard'
    : location.pathname.replace('/', '');

  /* ── Fetch ── */
  const fetchItems = useCallback(async (query = '') => {
    try {
      setError(null);
      const url = query ? `${API}?q=${encodeURIComponent(query)}` : API;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Server error');
      setItems(await res.json());
    } catch {
      setError('CONNECTION_REFUSED // Is the backend running on :8080?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems, location.pathname]);

  /* ── CRUD ── */
  const handleDelete = async (id) => {
    setActiveDeleteId(id);
    try {
      await fetch(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      // Re-fetch to get valid re-indexed IDs from server
      await fetchItems();
      setActiveDeleteId(null);
    } catch { setActiveDeleteId(null); }
  };

  const handleSave = async (data) => {
    try {
      if (editingItem) {
        await fetch(`${API}/${encodeURIComponent(editingItem.id)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        await fetch(API, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
      // Re-fetch to get sorted list from server
      await fetchItems();
    } catch (err) { console.error(err); }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  /* ── Quick Sell (optimistic) ── */
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleQuickSell = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item || item.stock <= 0) return;

    // Optimistic: immediately decrement stock on screen
    setItems(prev => prev.map(i =>
      i.id === id
        ? { ...i, stock: i.stock - 1, status: (i.stock - 1) < 5 ? 'LOW_STOCK' : 'IN_STOCK' }
        : i
    ));

    try {
      const res = await fetch('/api/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quantity: 1 }),
      });

      if (!res.ok) {
        const err = await res.json();
        // Revert optimistic update
        setItems(prev => prev.map(i =>
          i.id === id ? { ...i, stock: i.stock + 1, status: (i.stock + 1) < 5 ? 'LOW_STOCK' : 'IN_STOCK' } : i
        ));
        showToast(err.error || 'SALE_FAILED', 'error');
        return;
      }

      showToast(`SALE_RECORDED: ${item.name} × 1`, 'success');
    } catch {
      // Revert on network error
      setItems(prev => prev.map(i =>
        i.id === id ? { ...i, stock: i.stock + 1, status: (i.stock + 1) < 5 ? 'LOW_STOCK' : 'IN_STOCK' } : i
      ));
      showToast('NETWORK_ERROR: Sale failed', 'error');
    }
  };

  /* ── Render ── */
  return (
    <Layout activePage={activePage}>
      {/* Error banner */}
      {error && (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 px-6 py-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 font-mono text-sm text-red-400 max-w-2xl">
          <WifiOff className="w-5 h-5 shrink-0" /> <span>{error}</span>
        </motion.div>
      )}

      {loading && (activePage === 'dashboard' || activePage === 'inventory') ? (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4 font-mono text-[var(--color-neon-cyan)]">
          <Loader className="w-8 h-8 animate-spin" />
          <span>LOADING_INVENTORY...</span>
        </div>
      ) : (
        <Routes>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/inventory" element={
            <Dashboard
              items={items}
              onSearch={fetchItems}
              onDelete={handleDelete}
              onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }}
              onAdd={() => { setEditingItem(null); setIsModalOpen(true); }}
              onSell={handleQuickSell}
              isDeleting={activeDeleteId}
            />
          } />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}

      <InventoryModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
        onSave={handleSave}
        initialData={editingItem}
      />

      {/* ═══ TOAST NOTIFICATION ═══ */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 50 }}
          className={`fixed bottom-6 left-1/2 z-50 px-6 py-3 rounded-xl border backdrop-blur-xl font-mono text-sm flex items-center gap-3 shadow-[0_0_30px_rgba(0,0,0,0.5)] ${toast.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
        >
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4" />
            : <AlertTriangle className="w-4 h-4" />
          }
          {toast.message}
        </motion.div>
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
