const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { stmts, refreshInventory } = require("../models/dbStore");
const { autoClassifyIfNeeded } = require("../agents/classifyAgent");

// Middleware untuk memverifikasi role bisa ditambahkan jika ada middleware global JWT
// Saat ini kita asumsikan middleware / perlindungan dihandle di frontend, tapi sebaiknya dilindungi.

// ─── PRODUCTION JOBS ───

router.get("/jobs", (req, res) => {
    try {
        const jobs = stmts.getProductionJobs.all();
        res.json({ success: true, jobs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post("/tutup-buku", (req, res) => {
    try {
        const jobsToArchive = stmts.getJobsForRollup.get();
        if (!jobsToArchive || jobsToArchive.length === 0) {
            return res.json({
                success: true,
                message: "Tidak ada data untuk ditutup buku.",
            });
        }

        const bulanSekarang = new Date().toISOString().slice(0, 7); // YYYY-MM
        const grouped = {};

        jobsToArchive.forEach((job) => {
            const key = `${job.supplier}_${job.tipe_remote}`;
            if (!grouped[key]) {
                grouped[key] = {
                    supplier: job.supplier || "Campuran (Lama)",
                    tipe_remote: job.tipe_remote,
                    bagus: 0,
                    rusak: 0,
                };
            }
            if (job.status === "RUSAK") {
                grouped[key].rusak += job.alokasi;
            } else {
                grouped[key].bagus += job.alokasi;
            }
        });

        // Simpan ke rollup
        const timestamp = new Date().toISOString();
        Object.values(grouped).forEach((g) => {
            stmts.insertAnalyticsRollup.run(
                crypto.randomUUID(),
                bulanSekarang,
                g.supplier,
                g.tipe_remote,
                g.bagus,
                g.rusak,
                timestamp
            );
        });

        // Hapus dari papan
        stmts.deleteJobsForRollup.run();

        res.json({
            success: true,
            message: `Berhasil tutup buku. ${jobsToArchive.length} tiket dikompresi.`,
        });
    } catch (err) {
        console.error("Tutup buku error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post("/jobs", (req, res) => {
    try {
        const { tipe_remote, komponen, kriteria, alokasi, supplier, merk } =
            req.body;
        if (!tipe_remote || !komponen || !alokasi) {
            return res
                .status(400)
                .json({ success: false, message: "Data tidak lengkap" });
        }

        const timestamp = new Date().toISOString();
        const catatan = "Masuk Gudang Mentah";

        stmts.insertProductionJob.run(
            crypto.randomUUID(),
            tipe_remote,
            komponen,
            kriteria,
            "MENTAH",
            catatan,
            Number(alokasi),
            null,
            timestamp,
            supplier,
            merk
        );
        res.json({ success: true, message: "Pekerjaan berhasil ditambahkan" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put("/jobs/:id", (req, res) => {
    try {
        const { id } = req.params;
        const { status, catatan } = req.body;

        stmts.updateProductionJobStatus.run(id, status, catatan);
        res.json({ success: true, message: "Status pekerjaan diperbarui" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post("/jobs/:id/qc", (req, res) => {
    try {
        const { id } = req.params;
        const {
            qcJual,
            qcRakit,
            qcRusak,
            qcRework,
            catatan,
            modifikasiVarian,
        } = req.body;

        const job = stmts.getProductionJobById.get(id);
        if (!job) {
            return res
                .status(404)
                .json({ success: false, message: "Pekerjaan tidak ditemukan" });
        }

        const totalInput =
            (qcJual || 0) + (qcRakit || 0) + (qcRusak || 0) + (qcRework || 0);
        if (totalInput !== job.alokasi) {
            return res
                .status(400)
                .json({
                    success: false,
                    message: "Total alokasi QC tidak cocok",
                });
        }

        const timestamp = new Date().toISOString();
        const baseCatatan = catatan ? ` - Catatan: ${catatan}` : "";

        stmts.deleteProductionJob.run(id);

        if (qcJual > 0 || qcRakit > 0) {
            // Pekerjaan ini tidak lagi masuk ke kolom Papan Produksi,
            // melainkan langsung dilempar ke Inventory (di blok JEMBATAN KE INVENTORY).
        }
        if (qcRusak > 0) {
            stmts.insertProductionJob.run(
                crypto.randomUUID(),
                job.tipe_remote,
                job.komponen,
                job.kriteria,
                "RUSAK",
                `Gagal QC${baseCatatan}`,
                qcRusak,
                job.assigned_to,
                timestamp,
                job.supplier,
                job.merk
            );
        }
        if (qcRework > 0) {
            stmts.insertProductionJob.run(
                crypto.randomUUID(),
                job.tipe_remote,
                job.komponen,
                job.kriteria,
                "GUDANG_CAT",
                `REWORK QC${baseCatatan}`,
                qcRework,
                job.assigned_to,
                timestamp,
                job.supplier,
                job.merk
            );
        }

        // --- JEMBATAN KE INVENTORY (WMS) ---
        const totalLulus = (qcJual || 0) + (qcRakit || 0);
        if (totalLulus > 0) {
            let finalTipeRemote = job.tipe_remote;
            if (modifikasiVarian && modifikasiVarian.trim()) {
                finalTipeRemote = `${finalTipeRemote} ${modifikasiVarian.trim()}`;
            }
            const modifiedJob = { ...job, tipe_remote: finalTipeRemote };

            const inventoryResult = stmts.upsertInventoryFromQC.run(
                modifiedJob,
                totalLulus
            );
            refreshInventory(); // <--- This ensures the frontend gets the new data
            if (inventoryResult && inventoryResult.isNew) {
                // Trigger Hermes untuk klasifikasi otomatis
                autoClassifyIfNeeded(inventoryResult.id).catch((e) =>
                    console.error(
                        "[HERMES] Gagal memicu autoClassify:",
                        e.message
                    )
                );
            }
        }

        res.json({
            success: true,
            message: "QC selesai, stok masuk ke Inventory",
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post("/jobs/:id/sortir", (req, res) => {
    try {
        const { id } = req.params;
        const { sortirCuci, sortirCat, sortirKimia } = req.body;

        const job = stmts.getProductionJobById.get(id);
        if (!job) {
            return res
                .status(404)
                .json({ success: false, message: "Pekerjaan tidak ditemukan" });
        }

        const total = (sortirCuci || 0) + (sortirCat || 0) + (sortirKimia || 0);

        if (total !== job.alokasi) {
            return res
                .status(400)
                .json({
                    success: false,
                    message: "Total sortir tidak sesuai dengan jumlah barang!",
                });
        }

        stmts.deleteProductionJob.run(id);
        const timestamp = new Date().toISOString();

        if (sortirCuci > 0) {
            stmts.insertProductionJob.run(
                crypto.randomUUID(),
                job.tipe_remote,
                job.komponen,
                job.kriteria,
                "GUDANG_CUCI",
                "Hasil Sortir (Cuci Saja)",
                sortirCuci,
                job.assigned_to,
                timestamp,
                job.supplier,
                job.merk
            );
        }
        if (sortirCat > 0) {
            stmts.insertProductionJob.run(
                crypto.randomUUID(),
                job.tipe_remote,
                job.komponen,
                job.kriteria,
                "GUDANG_CAT",
                "Hasil Sortir (Perlu Cat)",
                sortirCat,
                job.assigned_to,
                timestamp,
                job.supplier,
                job.merk
            );
        }
        if (sortirKimia > 0) {
            stmts.insertProductionJob.run(
                crypto.randomUUID(),
                job.tipe_remote,
                job.komponen,
                job.kriteria,
                "GUDANG_KIMIA",
                "Hasil Sortir (Pemutihan Kimia)",
                sortirKimia,
                job.assigned_to,
                timestamp,
                job.supplier,
                job.merk
            );
        }

        res.json({
            success: true,
            message: "Barang berhasil disortir ke gudang",
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post("/jobs/:id/tarik", (req, res) => {
    try {
        const { id } = req.params;
        const { jumlah, targetStatus } = req.body;

        const job = stmts.getProductionJobById.get(id);
        if (!job) {
            return res
                .status(404)
                .json({ success: false, message: "Pekerjaan tidak ditemukan" });
        }

        if (jumlah <= 0 || jumlah > job.alokasi) {
            return res
                .status(400)
                .json({ success: false, message: "Jumlah tidak valid!" });
        }

        const timestamp = new Date().toISOString();

        if (jumlah === job.alokasi) {
            // Tarik semua, cukup update status
            stmts.updateProductionJobStatus.run(
                id,
                targetStatus,
                `Ditarik penuh ke ${targetStatus}`
            );
        } else {
            // Tarik sebagian, belah data
            stmts.deleteProductionJob.run(id);
            const sisaGudang = job.alokasi - jumlah;

            if (sisaGudang > 0) {
                // Keep remainder in the current bucket
                stmts.insertProductionJob.run(
                    crypto.randomUUID(),
                    job.tipe_remote,
                    job.komponen,
                    job.kriteria,
                    job.status,
                    "Sisa dari penarikan parsial",
                    sisaGudang,
                    job.assigned_to,
                    timestamp,
                    job.supplier,
                    job.merk
                );
            }

            // Tarik sebagian ke proses
            stmts.insertProductionJob.run(
                crypto.randomUUID(),
                job.tipe_remote,
                job.komponen,
                job.kriteria,
                targetStatus,
                `Ditarik parsial dari ${job.status}`,
                jumlah,
                job.assigned_to,
                timestamp,
                job.supplier,
                job.merk
            );
        }

        res.json({ success: true, message: "Barang berhasil ditarik" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Endpoint untuk Tarik sekaligus Pre-Process Sortir (Self-QC)
router.post("/jobs/:id/tarik-sortir", (req, res) => {
    try {
        const { id } = req.params;
        const { jumlahBagus, jumlahRusak, targetStatus } = req.body;

        const job = stmts.getProductionJobById.get(id);
        if (!job) {
            return res
                .status(404)
                .json({ success: false, message: "Pekerjaan tidak ditemukan" });
        }

        const total = (jumlahBagus || 0) + (jumlahRusak || 0);

        if (total <= 0 || total > job.alokasi) {
            return res
                .status(400)
                .json({
                    success: false,
                    message: "Jumlah tidak valid atau melebihi alokasi!",
                });
        }

        const timestamp = new Date().toISOString();

        // Hapus pekerjaan asli dari antrean gudang
        stmts.deleteProductionJob.run(id);

        const sisaGudang = job.alokasi - total;

        // 1. Kembalikan sisa ke gudang asal jika ditarik parsial
        if (sisaGudang > 0) {
            stmts.insertProductionJob.run(
                crypto.randomUUID(),
                job.tipe_remote,
                job.komponen,
                job.kriteria,
                job.status,
                "Sisa dari penarikan sortir parsial",
                sisaGudang,
                job.assigned_to,
                timestamp,
                job.supplier,
                job.merk
            );
        }

        // 2. Masukkan yang bagus ke meja proses (PROSES_CUCI / PROSES_CAT)
        if (jumlahBagus > 0) {
            stmts.insertProductionJob.run(
                crypto.randomUUID(),
                job.tipe_remote,
                job.komponen,
                job.kriteria,
                targetStatus,
                `Lulus sortir awal dari ${job.status}`,
                jumlahBagus,
                job.assigned_to,
                timestamp,
                job.supplier,
                job.merk
            );
        }

        // 3. Masukkan yang rusak ke kolom RUSAK
        if (jumlahRusak > 0) {
            stmts.insertProductionJob.run(
                crypto.randomUUID(),
                job.tipe_remote,
                job.komponen,
                job.kriteria,
                "RUSAK",
                `Disortir rusak saat masuk ${targetStatus}`,
                jumlahRusak,
                job.assigned_to,
                timestamp,
                job.supplier,
                job.merk
            );
        }

        res.json({
            success: true,
            message: "Barang berhasil disortir dan ditarik",
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post("/jobs/:id/afkir", (req, res) => {
    try {
        const { id } = req.params;
        const { jumlahRusak, catatan } = req.body;

        const job = stmts.getProductionJobById.get(id);
        if (!job) {
            return res
                .status(404)
                .json({ success: false, message: "Pekerjaan tidak ditemukan" });
        }

        if (jumlahRusak <= 0 || jumlahRusak > job.alokasi) {
            return res
                .status(400)
                .json({ success: false, message: "Jumlah afkir tidak valid!" });
        }

        const timestamp = new Date().toISOString();

        if (jumlahRusak === job.alokasi) {
            // Semua rusak
            stmts.updateProductionJobStatus.run(
                id,
                "RUSAK",
                catatan || "Afkir total saat proses"
            );
        } else {
            // Sebagian rusak, belah data
            stmts.deleteProductionJob.run(id);
            const sisaProses = job.alokasi - jumlahRusak;

            if (sisaProses > 0) {
                // Sisa barang tetap lanjut di status sebelumnya (belum rusak semua)
                stmts.insertProductionJob.run(
                    crypto.randomUUID(),
                    job.tipe_remote,
                    job.komponen,
                    job.kriteria,
                    job.status,
                    job.catatan,
                    sisaProses,
                    job.assigned_to,
                    timestamp,
                    job.supplier,
                    job.merk
                );
            }

            // Lempar yang rusak ke tong rusak
            stmts.insertProductionJob.run(
                crypto.randomUUID(),
                job.tipe_remote,
                job.komponen,
                job.kriteria,
                "RUSAK",
                catatan || `Afkir dari ${job.status}`,
                jumlahRusak,
                job.assigned_to,
                timestamp,
                job.supplier,
                job.merk
            );
        }

        res.json({ success: true, message: "Barang rusak berhasil disortir" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete("/jobs/:id", (req, res) => {
    try {
        stmts.deleteProductionJob.run(req.params.id);
        res.json({ success: true, message: "Pekerjaan dihapus" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── SUPPLY REPORTS ───

router.get("/supplies", (req, res) => {
    try {
        const reports = stmts.getSupplyReports.all();
        res.json({ success: true, reports });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post("/supplies", (req, res) => {
    try {
        const { pekerja, laporan } = req.body;
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        stmts.insertSupplyReport.run(
            id,
            pekerja,
            laporan,
            "PENDING",
            timestamp
        );
        res.status(201).json({
            success: true,
            message: "Laporan perlengkapan terkirim",
            id,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put("/supplies/:id", (req, res) => {
    try {
        const { status } = req.body;
        stmts.updateSupplyReportStatus.run(req.params.id, status);
        res.json({ success: true, message: "Status laporan diperbarui" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
