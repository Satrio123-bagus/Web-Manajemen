import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader, WifiOff, CheckCircle, AlertTriangle } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import Layout from './components/Layout';
import Dashboard, { InventoryModal } from './pages/Dashboard';
import DashboardHome from './pages/DashboardHome';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Terminal from './pages/Terminal';
import { SettingsProvider } from './context/SettingsContext';
import { useSound } from './hooks/useSound';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API = '/api/items';

function AppContent() {
  const [activeDeleteId, setActiveDeleteId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const { playSound } = useSound();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Derive activePage from URL
  const activePage = location.pathname === '/' ? 'dashboard'
    : location.pathname.replace('/', '');

  /* ── React Query Fetch ── */
  const { data: qData, isLoading: loading, error: qError } = useQuery({
    queryKey: ['items', { q: searchQuery, page }],
    queryFn: async () => {
      let url = API;
      if (searchQuery) {
        url = `${API}?q=${encodeURIComponent(searchQuery)}`;
      } else {
        // We use page limit for standard view
        url = `${API}?page=${page}&limit=50`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('CONNECTION_REFUSED // Gagal terhubung ke Server API');
      return res.json();
    },
    staleTime: 60000, 
  });

  const error = qError ? qError.message : null;
  // If the server returns paginated data (has .data array), use that, otherwise fallback to array result
  const items = qData?.data ? qData.data : (Array.isArray(qData) ? qData : []);
  const meta = qData?.total ? { total: qData.total, page: qData.page, totalPages: qData.totalPages } : null;

  /* ── Mutations ── */
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      return id;
    },
    onMutate: () => { playSound('click'); },
    onSuccess: () => {
      playSound('success');
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setActiveDeleteId(null);
    },
    onError: () => {
      playSound('error');
      setActiveDeleteId(null);
    }
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const url = id ? `${API}/${encodeURIComponent(id)}` : API;
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onMutate: () => { playSound('click'); },
    onSuccess: () => {
      playSound('success');
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setIsModalOpen(false);
      setEditingItem(null);
    },
    onError: (err) => {
      console.error(err);
      playSound('error');
    }
  });

  const handleDelete = (id) => {
    setActiveDeleteId(id);
    deleteMutation.mutate(id);
  };

  const handleSave = (data) => {
    saveMutation.mutate({ id: editingItem?.id, data });
  };


  /* ── Quick Sell (optimistic) ── */
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const sellMutation = useMutation({
    mutationFn: async ({ id }) => {
      const res = await fetch('/api/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quantity: 1 }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'SALE_FAILED');
      }
      return await res.json();
    },
    onMutate: async ({ id }) => {
      playSound('click');
      // Optimistic Update
      await queryClient.cancelQueries({ queryKey: ['items'] });
      const previousData = queryClient.getQueryData(['items', { q: searchQuery, page }]);
      queryClient.setQueryData(['items', { q: searchQuery, page }], (old) => {
        if (!old) return old;
        const processItem = (i) => i.id === id ? { ...i, stock: i.stock - 1, status: (i.stock - 1) < 5 ? 'LOW_STOCK' : 'IN_STOCK' } : i;
        if (old.data) return { ...old, data: old.data.map(processItem) };
        return old.map(processItem);
      });
      return { previousData };
    },
    onSuccess: (_, { itemInfo }) => {
      playSound('success');
      showToast(`SALE_RECORDED: ${itemInfo.name} × 1`, 'success');
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onError: (err, _, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['items', { q: searchQuery, page }], context.previousData);
      }
      playSound('error');
      showToast(err.message || 'NETWORK_ERROR: Sale failed', 'error');
    }
  });

  const handleQuickSell = (id) => {
    const item = items.find(i => i.id === id);
    if (!item || item.stock <= 0) {
      playSound('error');
      return;
    }
    sellMutation.mutate({ id, itemInfo: item });
  };

  /* ── Render ── */
  return (
    <Layout activePage={activePage} onSearch={(q) => setSearchQuery(q)}>
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
              meta={meta}
              onPageChange={setPage}
              onSearch={(q) => setSearchQuery(q)}
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
    <SettingsProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </SettingsProvider>
  );
}
