import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'

// Inisialisasi Sentry
// Hanya aktif jika VITE_SENTRY_DSN tersedia di .env
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,     // Jangan samarkan semua teks agar replay bisa dibaca
        blockAllMedia: true,    // Jangan rekam gambar/media untuk menghemat kuota
      }),
    ],
    // Tracing / Performance Monitoring
    tracesSampleRate: 0.1, // Rekam 10% dari transaksi untuk Performance (hemat kuota)
    
    // Session Replay
    replaysSessionSampleRate: 0.1, // Rekam 10% sesi secara acak
    replaysOnErrorSampleRate: 1.0, // TAPI selalu rekam 100% jika terjadi error

    // Privacy / PII Filtering
    beforeSend(event) {
      // Hapus data sensitif sebelum dikirim ke server Sentry
      if (event.request && event.request.data) {
        try {
          const payload = typeof event.request.data === 'string' 
            ? JSON.parse(event.request.data) 
            : event.request.data;
            
          // Hapus field password / PIN / Auth
          if (payload.password) payload.password = '***';
          if (payload.pin) payload.pin = '***';
          if (payload.passphrase) payload.passphrase = '***';
          
          event.request.data = typeof event.request.data === 'string'
            ? JSON.stringify(payload)
            : payload;
        } catch (e) {
          // Abaikan jika tidak bisa di-parse
        }
      }
      return event;
    },
  });
  console.log('[Sentry] Initialized for React Frontend');
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent refetching unnecessarily when tabbing back
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

// ─── PWA: Register Service Worker ─────────────────────────────────────────
// Hanya aktifkan di production (HTTPS) agar tidak mengganggu proses development.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => console.log('[PWA] Service Worker registered:', reg.scope))
      .catch((err) => console.error('[PWA] Service Worker failed:', err));
  });
}
