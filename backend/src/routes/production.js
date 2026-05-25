const express = require('express');
const router = express.Router();
const { stmts } = require('../models/dbStore');
const crypto = require('crypto');

// Middleware untuk memverifikasi role bisa ditambahkan jika ada middleware global JWT
// Saat ini kita asumsikan middleware / perlindungan dihandle di frontend, tapi sebaiknya dilindungi.

// ─── PRODUCTION JOBS ───

router.get('/jobs', (req, res) => {
    try {
        const jobs = stmts.getProductionJobs.all();
        res.json({ success: true, jobs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/jobs', (req, res) => {
    try {
        const { tipe_remote, komponen, kriteria, alokasi, supplier } = req.body;
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        
        stmts.insertProductionJob.run(
            id, tipe_remote, komponen, kriteria || '', 'MENTAH', '', alokasi || 1, null, timestamp, supplier
        );
        res.status(201).json({ success: true, message: 'Pekerjaan ditambahkan', id });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/jobs/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { status, catatan } = req.body;
        
        stmts.updateProductionJobStatus.run(id, status, catatan);
        res.json({ success: true, message: 'Status pekerjaan diperbarui' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/jobs/:id/qc', (req, res) => {
    try {
        const { id } = req.params;
        const { qcJual, qcRakit, qcRusak } = req.body;
        
        const job = stmts.getProductionJobById.get(id);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Pekerjaan tidak ditemukan' });
        }
        
        const total = (qcJual || 0) + (qcRakit || 0) + (qcRusak || 0);
        if (total !== job.alokasi) {
            return res.status(400).json({ success: false, message: 'Total alokasi QC tidak sesuai dengan jumlah barang!' });
        }
        
        // Split functionality:
        // Delete original job, then create new jobs for each bucket that has > 0 quantity
        stmts.deleteProductionJob.run(id);
        const timestamp = new Date().toISOString();
        
        if (qcJual > 0) {
            stmts.insertProductionJob.run(crypto.randomUUID(), job.tipe_remote, job.komponen, job.kriteria, 'SELESAI_JUAL', 'Dari QC Split (Jual)', qcJual, job.assigned_to, timestamp, job.supplier);
        }
        if (qcRakit > 0) {
            stmts.insertProductionJob.run(crypto.randomUUID(), job.tipe_remote, job.komponen, job.kriteria, 'SELESAI_RAKIT', 'Dari QC Split (Rakit)', qcRakit, job.assigned_to, timestamp, job.supplier);
        }
        if (qcRusak > 0) {
            stmts.insertProductionJob.run(crypto.randomUUID(), job.tipe_remote, job.komponen, job.kriteria, 'RUSAK', 'Dari QC Split (Rusak)', qcRusak, job.assigned_to, timestamp, job.supplier);
        }
        
        res.json({ success: true, message: 'Alokasi QC berhasil diproses' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/jobs/:id/sortir', (req, res) => {
    try {
        const { id } = req.params;
        const { sortirCuci, sortirCat } = req.body;
        
        const job = stmts.getProductionJobById.get(id);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Pekerjaan tidak ditemukan' });
        }
        
        const total = (sortirCuci || 0) + (sortirCat || 0);
        if (total !== job.alokasi) {
            return res.status(400).json({ success: false, message: 'Total sortir tidak sesuai dengan jumlah barang!' });
        }
        
        stmts.deleteProductionJob.run(id);
        const timestamp = new Date().toISOString();
        
        if (sortirCuci > 0) {
            stmts.insertProductionJob.run(crypto.randomUUID(), job.tipe_remote, job.komponen, job.kriteria, 'GUDANG_CUCI', 'Hasil Sortir (Cuci Saja)', sortirCuci, job.assigned_to, timestamp, job.supplier);
        }
        if (sortirCat > 0) {
            stmts.insertProductionJob.run(crypto.randomUUID(), job.tipe_remote, job.komponen, job.kriteria, 'GUDANG_CAT', 'Hasil Sortir (Perlu Cat)', sortirCat, job.assigned_to, timestamp, job.supplier);
        }
        
        res.json({ success: true, message: 'Barang berhasil disortir ke gudang' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/jobs/:id/tarik', (req, res) => {
    try {
        const { id } = req.params;
        const { jumlah, targetStatus } = req.body;
        
        const job = stmts.getProductionJobById.get(id);
        if (!job) {
            return res.status(404).json({ success: false, message: 'Pekerjaan tidak ditemukan' });
        }
        
        if (jumlah <= 0 || jumlah > job.alokasi) {
            return res.status(400).json({ success: false, message: 'Jumlah tidak valid!' });
        }
        
        const timestamp = new Date().toISOString();
        
        if (jumlah === job.alokasi) {
            // Tarik semua, cukup update status
            stmts.updateProductionJobStatus.run(id, targetStatus, `Ditarik penuh ke ${targetStatus}`);
        } else {
            // Tarik sebagian, belah data
            stmts.deleteProductionJob.run(id);
            const sisaGudang = job.alokasi - jumlah;
            
            // Simpan sisa di gudang
            stmts.insertProductionJob.run(crypto.randomUUID(), job.tipe_remote, job.komponen, job.kriteria, job.status, 'Sisa dari penarikan parsial', sisaGudang, job.assigned_to, timestamp, job.supplier);
            
            // Tarik sebagian ke proses
            stmts.insertProductionJob.run(crypto.randomUUID(), job.tipe_remote, job.komponen, job.kriteria, targetStatus, `Ditarik parsial dari ${job.status}`, jumlah, job.assigned_to, timestamp, job.supplier);
        }
        
        res.json({ success: true, message: 'Barang berhasil ditarik' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/jobs/:id', (req, res) => {
    try {
        stmts.deleteProductionJob.run(req.params.id);
        res.json({ success: true, message: 'Pekerjaan dihapus' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── SUPPLY REPORTS ───

router.get('/supplies', (req, res) => {
    try {
        const reports = stmts.getSupplyReports.all();
        res.json({ success: true, reports });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/supplies', (req, res) => {
    try {
        const { pekerja, laporan } = req.body;
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        
        stmts.insertSupplyReport.run(id, pekerja, laporan, 'PENDING', timestamp);
        res.status(201).json({ success: true, message: 'Laporan perlengkapan terkirim', id });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.put('/supplies/:id', (req, res) => {
    try {
        const { status } = req.body;
        stmts.updateSupplyReportStatus.run(req.params.id, status);
        res.json({ success: true, message: 'Status laporan diperbarui' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
