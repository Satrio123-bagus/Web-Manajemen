# Konteks Proyek: Web-Manajemen

## Ringkasan Proyek
Ini adalah proyek aplikasi manajemen berbasis web. Proyek ini menggunakan arsitektur pemisahan antara frontend (Client) dan backend (Server), dan dirancang untuk dijalankan menggunakan kontainer.

## Teknologi & Stack
* **Frontend (Client):** React.js + Vite
* **Backend (Server):** Node.js
* **Bahasa Utama:** JavaScript, HTML, CSS
* **Deployment/Infrastruktur:** Docker & Docker Compose (Target server: Ubuntu 24.04 LTS)
* **Editor:** VS Code

## Struktur Direktori Utama
* `/client` : Berisi semua kode untuk frontend (React/Vite). Semua perintah terkait UI, komponen, dan styling dikerjakan di sini.
* `/server` : Berisi semua kode untuk backend (Node.js/API). Semua logika bisnis, routing, dan koneksi database dikerjakan di sini.
* `docker-compose.yml` : File konfigurasi utama untuk menjalankan proyek secara keseluruhan (client dan server) secara terisolasi.

## Aturan Pengembangan (Development Rules) untuk Agen AI
1.  **Pemisahan Tugas (Separation of Concerns):** Jangan mencampuradukkan kode frontend dan backend. Pastikan modifikasi frontend hanya dilakukan di dalam folder `/client` dan backend di `/server`.
2.  **Gunakan Docker:** Jika Anda (AI) perlu menjalankan, menguji, atau merekomendasikan perintah eksekusi aplikasi, utamakan menggunakan perintah `docker compose` alih-alih menjalankan npm/node secara langsung di host.
3.  **Gaya Penulisan Kode (Coding Style):** * Gunakan sintaks JavaScript modern (ES6+).
    * Tulis kode yang bersih, mudah dibaca, dan berikan komentar pada bagian logika yang kompleks atau konfigurasi khusus.
    * Perhatikan penggunaan port agar tidak terjadi bentrok antara service client dan server saat dijalankan via Docker.
4.  **Debugging Web:** Saat membantu melakukan *debugging* pada proyek web ini, selidiki log dari *container* Docker masing-masing layanan (client/server) terlebih dahulu.