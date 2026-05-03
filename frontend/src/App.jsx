import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Loader, WifiOff, CheckCircle, AlertTriangle } from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import Layout from './components/Layout';
import Dashboard, { InventoryModal, AssembleModal } from './pages/Dashboard';
import DashboardHome from './pages/DashboardHome';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Terminal from './pages/Terminal';
import Login from './pages/Login';
import TransactionHistory from './pages/TransactionHistory';
import BarcodeStudio from './pages/BarcodeStudio';
import MobileScanner from './pages/MobileScanner';
import { SettingsProvider } from './context/SettingsContext';
import { useSound } from './hooks/useSound';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { fetchApi } from './api';

const API = '/api/items';

function AppContent() {
  const [token, setToken] = useState(localStorage.getItem('cortex_token'));
  const [activeDeleteId, setActiveDeleteId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [assemblingItem, setAssemblingItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const { playSound } = useSound();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Derive activePage from URL
  const activePage = location.pathname === '/' ? 'dashboard'
    : location.pathname.replace('/', '');

  /* ── React Query Fetch ── */
  const { data: qData, isLoading: loading, error: qError } = useQuery({
    queryKey: ['items', { q: searchQuery, page, limit }],
    queryFn: async () => {
      let url = API;
      if (searchQuery) {
        url = `${API}?q=${encodeURIComponent(searchQuery)}`;
      } else {
        url = `${API}?page=${page}&limit=${limit}`;
      }
      const res = await api.get(url);
      if (!res.ok) {
        if (res.status === 401) {
            localStorage.removeItem('cortex_token');
            setToken(null);
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || `HTTP_ERROR_${res.status} // API menolak koneksi`);
      }
      return res.json();
    },
    staleTime: 60000, 
    enabled: !!token,
  });

  const error = qError ? qError.message : null;
  // If the server returns paginated data (has .data array), use that, otherwise fallback to array result
  const items = qData?.data ? qData.data : (Array.isArray(qData) ? qData : []);
  const meta = qData?.total ? { total: qData.total, page: qData.page, totalPages: qData.totalPages } : null;

  /* ── Mutations ── */
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`${API}/${encodeURIComponent(id)}`);
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
      const res = await fetchApi(url, {
        method,
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

  const assembleMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post(`${API}/assemble`, data);
      if (!res.ok) {
        if (res.status === 401) {
            localStorage.removeItem('cortex_token');
            setToken(null);
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || 'ASSEMBLY_FAILED');
      }
      return await res.json();
    },
    onMutate: () => { playSound('click'); },
    onSuccess: (data) => {
      playSound('success');
      showToast(`ASSEMBLY_SUCCESS: ${data.quantity} units assembled`, 'success');
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setAssemblingItem(null);
    },
    onError: (err) => {
      console.error(err);
      playSound('error');
      showToast(err.message || 'ASSEMBLY_ERROR', 'error');
    }
  });

  const handleAssemble = (data) => {
    assembleMutation.mutate(data);
  };


  /* ── Quick Sell (optimistic) ── */
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const sellMutation = useMutation({
    mutationFn: async ({ id }) => {
      const res = await api.post('/sell', { id, quantity: 1 });
      if (!res.ok) {
        if (res.status === 401) {
            localStorage.removeItem('cortex_token');
            setToken(null);
        }
        const err = await res.json().catch(() => ({}));
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
        const processItem = (i) => i.id === id ? { ...i, stock: i.stock - 1, status: (i.stock - 1) < 2 ? 'LOW_STOCK' : 'IN_STOCK' } : i;
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
  if (!token) {
    return <Login onLogin={setToken} />;
  }

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
              limit={limit}
              onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
              onSearch={(q) => setSearchQuery(q)}
              onDelete={handleDelete}
              onEdit={(item) => { setEditingItem(item); setIsModalOpen(true); }}
              onAdd={() => { setEditingItem(null); setIsModalOpen(true); }}
              onSell={handleQuickSell}
              onAssemble={(item) => setAssemblingItem(item)}
              isDeleting={activeDeleteId}
            />
          } />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/history" element={<TransactionHistory />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/barcode-studio" element={<BarcodeStudio />} />
          <Route path="/scanner" element={<MobileScanner />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}

      <InventoryModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
        onSave={handleSave}
        initialData={editingItem}
      />

      <AssembleModal
        isOpen={!!assemblingItem}
        onClose={() => setAssemblingItem(null)}
        onSave={handleAssemble}
        sourceItem={assemblingItem}
        allItems={items}
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
