#!/bin/bash
# ─── BACKUP DATABASE INSERT3COINS ────────────────────────────────────────────
# Script ini membuat backup otomatis file SQLite inventory ke folder lokal.
# Dijadwalkan via cron di VPS — jalankan setiap hari jam 01:00 WIB.
#
# CARA SETUP DI VPS:
# 1. Upload script ini ke VPS
# 2. chmod +x backup_db.sh
# 3. Tambahkan ke crontab: crontab -e
#    Tambahkan baris: 0 18 * * * /path/ke/project/backup_db.sh >> /path/ke/project/backup.log 2>&1
#    (18:00 UTC = 01:00 WIB)

# ─── KONFIGURASI ─────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"   # Otomatis deteksi folder project
DB_SOURCE="$PROJECT_DIR/backend/data/inventory.db"
BACKUP_DIR="$PROJECT_DIR/backups"
MAX_BACKUPS=30                                  # Simpan maksimal 30 backup (1 bulan)
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/inventory_backup_$TIMESTAMP.db"

# ─── BUAT FOLDER BACKUP JIKA BELUM ADA ───────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "[$TIMESTAMP] Memulai backup database..."

# ─── COPIA FILE DATABASE ─────────────────────────────────────────────────────
if [ ! -f "$DB_SOURCE" ]; then
    echo "[$TIMESTAMP] ERROR: File database tidak ditemukan di $DB_SOURCE"
    exit 1
fi

# Gunakan sqlite3 untuk backup yang aman (tidak corrupt saat DB sedang aktif)
if command -v sqlite3 &> /dev/null; then
    sqlite3 "$DB_SOURCE" ".backup '$BACKUP_FILE'"
    echo "[$TIMESTAMP] ✓ Backup via sqlite3: $BACKUP_FILE"
else
    # Fallback: copy biasa
    cp "$DB_SOURCE" "$BACKUP_FILE"
    echo "[$TIMESTAMP] ✓ Backup via cp: $BACKUP_FILE"
fi

# ─── HAPUS BACKUP LAMA (lebih dari MAX_BACKUPS) ───────────────────────────────
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/inventory_backup_*.db 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    TO_DELETE=$((BACKUP_COUNT - MAX_BACKUPS))
    ls -1t "$BACKUP_DIR"/inventory_backup_*.db | tail -n "$TO_DELETE" | xargs rm -f
    echo "[$TIMESTAMP] 🗑️  Hapus $TO_DELETE backup lama."
fi

FINAL_COUNT=$(ls -1 "$BACKUP_DIR"/inventory_backup_*.db 2>/dev/null | wc -l)
echo "[$TIMESTAMP] ✅ Backup selesai. Total backup tersimpan: $FINAL_COUNT/$MAX_BACKUPS"
echo "[$TIMESTAMP] 📁 Lokasi: $BACKUP_DIR"
