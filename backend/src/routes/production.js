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
        const { tipe_remote, komponen, kriteria, alokasi } = req.body;
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        
        stmts.insertProductionJob.run(
            id, tipe_remote, komponen, kriteria || '', 'MENTAH', '', alokasi || 1, null, timestamp
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
