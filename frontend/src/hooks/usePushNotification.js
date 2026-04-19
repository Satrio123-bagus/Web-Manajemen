// ─── HOOK: usePushNotification ───────────────────────────────────────────────
// Hook ini mengelola seluruh lifecycle Web Push Notification di sisi browser:
// - Cek dukungan browser
// - Mendaftarkan Service Worker
// - Meminta izin push ke pengguna
// - Subscribe/Unsubscribe dari server
// - Menyimpan status di localStorage agar persisten

import { useState, useEffect, useCallback } from 'react';
import api from '../api';

/**
 * Konversi base64 ke Uint8Array.
 * Diperlukan untuk format applicationServerKey pada pushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return new Uint8Array([...rawData].map((char) => char.charCodeAt(0)));
}

export function usePushNotification() {
    // Status utama
    const [isSupported, setIsSupported] = useState(false);
    const [permission, setPermission] = useState('default'); // default | granted | denied
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Cek dukungan browser saat pertama kali load
    useEffect(() => {
        const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
        setIsSupported(supported);

        if (supported) {
            setPermission(Notification.permission);
            // Cek apakah sudah subscribe sebelumnya
            navigator.serviceWorker.ready.then((reg) => {
                reg.pushManager.getSubscription().then((sub) => {
                    setIsSubscribed(!!sub);
                });
            }).catch(() => {});
        }
    }, []);

    /**
     * Minta izin pengguna & subscribe ke server
     */
    const subscribe = useCallback(async () => {
        if (!isSupported) {
            setError('Browser kamu tidak mendukung push notification.');
            return false;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 1. Minta izin notifikasi ke pengguna
            const perm = await Notification.requestPermission();
            setPermission(perm);

            if (perm !== 'granted') {
                setError('Izin notifikasi ditolak. Aktifkan di pengaturan browser.');
                return false;
            }

            // 2. Ambil VAPID public key dari server
            const keyRes = await api.get('/push/vapid-key');
            if (!keyRes.ok) throw new Error('Server belum dikonfigurasi untuk push notification.');
            const { publicKey } = await keyRes.json();

            // 3. Daftarkan Service Worker dan buat subscription
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            });

            // 4. Kirim subscription ke backend untuk disimpan
            const subData = subscription.toJSON();
            const saveRes = await api.post('/push/subscribe', {
                endpoint: subData.endpoint,
                keys: subData.keys,
                userAgent: navigator.userAgent,
            });

            if (!saveRes.ok) throw new Error('Gagal menyimpan subscription ke server.');

            setIsSubscribed(true);
            console.log('[PUSH] Berhasil subscribe!');
            return true;
        } catch (err) {
            console.error('[PUSH] Error subscribe:', err.message);
            setError(err.message || 'Terjadi kesalahan saat mengaktifkan notifikasi.');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [isSupported]);

    /**
     * Unsubscribe dari push notification
     */
    const unsubscribe = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Hapus dari server dulu
                await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
                // Lalu batalkan subscription di browser
                await subscription.unsubscribe();
            }

            setIsSubscribed(false);
            setPermission('default');
            console.log('[PUSH] Berhasil unsubscribe.');
            return true;
        } catch (err) {
            console.error('[PUSH] Error unsubscribe:', err.message);
            setError(err.message);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Kirim notifikasi test (hanya untuk admin/debugging)
     */
    const sendTest = useCallback(async () => {
        try {
            const res = await api.post('/push/test', {});
            const json = await res.json();
            return json;
        } catch (err) {
            return { success: false, error: err.message };
        }
    }, []);

    return {
        isSupported,
        permission,
        isSubscribed,
        isLoading,
        error,
        subscribe,
        unsubscribe,
        sendTest,
    };
}
