// routes/brand.js
const express = require('express');
const router = express.Router();
const connection = require('../config/db');

// POST /api/brand/create
router.post('/create', (req, res) => {
  const {
    brand_name,
    owner_name,
    brand_line,
    brand_facebook,
    brand_email,
    brand_phonenumber,
    brand_note,
  } = req.body || {};

  const sql = `
    INSERT INTO brand
    (brand_name, owner_name, brand_line, brand_facebook, brand_email, brand_phonenumber, brand_note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    brand_name || null,
    owner_name || null,
    brand_line || null,
    brand_facebook || null,
    brand_email || null,
    brand_phonenumber || null,
    brand_note || null,
  ];

  connection.query(sql, params, (err, result) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ message: 'DB error' });
    }
    res.status(201).json({ brand_id: result.insertId });
  });
});

// GET /api/brand/read?q=...
router.get('/read', (req, res) => {
  const q = (req.query.q || '').trim();
  let sql = `
    SELECT brand_id, brand_name, owner_name, brand_line, brand_phonenumber
    FROM brand
  `;
  const params = [];
  if (q) {
    sql += `
      WHERE brand_name LIKE ? OR owner_name LIKE ? OR brand_line LIKE ? OR brand_phonenumber LIKE ?
    `;
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  connection.query(sql, params, (err, rows) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ message: 'DB error' });
    }
    res.json(rows);
  });
});

// GET /api/brand/read/:id
router.get('/read/:id', (req, res) => {
  const id = req.params.id;
  connection.query('SELECT * FROM brand WHERE brand_id = ?', [id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (!rows || rows.length === 0) return res.status(404).json({ message: 'Brand not found' });
    res.status(200).json(rows[0]);
  });
});

// PATCH /api/brand/update/:id
router.patch('/update/:id', (req, res) => {
  const id = req.params.id;
  const { brand_name, brand_line, brand_facebook, brand_email, brand_phonenumber, owner_name, brand_note } = req.body || {};
  connection.query(
    `UPDATE brand
     SET brand_name = ?, brand_line = ?, brand_facebook = ?, brand_email = ?, brand_phonenumber = ?, owner_name = ?, brand_note = ?
     WHERE brand_id = ?`,
    [brand_name, brand_line, brand_facebook, brand_email, brand_phonenumber, owner_name, brand_note, id],
    (err, result) => {
      if (err) return res.status(500).json({ message: 'DB error' });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Brand not found' });
      res.status(200).json({ message: 'Brand updated successfully' });
    }
  );
});

router.get("/read-all", (req, res) => {
  const sql = `
    SELECT b.brand_id, b.brand_name
    FROM brand b
    ORDER BY b.brand_name ASC
  `;
  connection.query(sql, (err, rows) => {
    if (err) {
      console.error("Read-all brand error:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(rows || []);
  });
});

// DELETE /api/brand/delete/:id
router.delete('/delete/:id', (req, res) => {
  const id = req.params.id;
  connection.query('DELETE FROM brand WHERE brand_id = ?', [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Brand not found' });
    res.status(200).json({ message: 'Brand deleted successfully' });
  });
});

module.exports = router;
