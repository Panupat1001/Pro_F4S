// routes/productorder.js
const express = require('express');
const router = express.Router();
const connection = require('../config/db');

const SORTABLE = new Set(['proorder_id', 'order_date', 'order_exp', 'order_quantity', 'price']);
const ORDER = new Set(['asc', 'desc']);

/// 👉 ต้องวางเหนือ router.get('/:id', ...) เสมอ
router.get('/:id/chems', (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id is required' });

  const sqlOrder = `
    SELECT product_id, order_quantity
    FROM productorder
    WHERE proorder_id = ?
    LIMIT 1
  `;
  connection.query(sqlOrder, [id], (err, rows) => {
    if (err) {
      console.error('[order chems] SELECT order error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    const { product_id } = rows[0];
    if (!product_id) return res.status(400).json({ error: 'Order has no product_id' });

    const sqlChems = `
      SELECT
        pd.productdetail_id,
        pd.product_id,
        pd.chem_id,
        COALESCE(pd.chem_percent, pd.percent, pd.percentage, 0) AS chem_percent,
        c.chem_name,
        c.inci_name,
        COALESCE(c.chem_quantity, c.chem_qty, c.quantity, c.qty, c.chem_stock, 0) AS chem_quantity,
        c.chem_unit
      FROM productdetail pd
      LEFT JOIN chem c ON c.chem_id = pd.chem_id
      WHERE pd.product_id = ?
      ORDER BY pd.productdetail_id ASC
    `;

    connection.query(sqlChems, [product_id], (err2, rows2) => {
      if (err2) {
        // log ให้เห็นสาเหตุจริงและคำสั่งที่รัน
        console.error('[order chems] SELECT chems error:',
          err2.code, err2.sqlMessage || err2.message, '\nSQL:', err2.sql);
        return res.status(500).json({ error: err2.message });
      }
      res.json({ items: rows2 || [] });
    });
  });
});


router.get('/list', (req, res) => {
  const q = (req.query.q || '').trim();
  const sortField = (req.query.sortField || 'order_date').trim();
  const sortOrder = (req.query.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // อนุญาตเฉพาะคอลัมน์ที่ปลอดภัยในการ sort
  const allowed = {
    product_name: 'p.product_name',
    order_lot: 'po.order_lot',
    order_date: 'po.order_date',
    order_exp: 'po.order_exp'
  };
  const sortBy = allowed[sortField] || 'po.order_date';

  const sql = `
    SELECT
      po.proorder_id,
      po.product_id,
      p.product_name,                 -- << สำคัญ
      po.order_lot,
      po.order_date,
      po.order_exp,
      po.order_quantity
    FROM productorder po
    LEFT JOIN product p ON p.product_id = po.product_id
    WHERE (? = '' 
           OR p.product_name LIKE CONCAT('%', ?, '%')
           OR po.order_lot   LIKE CONCAT('%', ?, '%'))
    ORDER BY ${sortBy} ${sortOrder}
  `;

  connection.query(sql, [q, q, q], (err, rows) => {
    if (err) {
      console.log('List productorder error:', err);
      return res.status(400).json({ error: err.message });
    }
    res.json({ items: rows });
  });
});

// CREATE
router.post('/create', (req, res) => {
  const {
    product_id, order_quantity, order_lot, order_date, order_exp,
    PH, color, smell, amount, price
  } = req.body;

  const sql = `
    INSERT INTO productorder (
      product_id, order_quantity, order_lot, order_date, order_exp,
      PH, color, smell, amount, price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  connection.query(
    sql,
    [
      product_id, order_quantity, order_lot || null, order_date || null, order_exp || null,
      PH ?? null, color ?? null, smell ?? null, amount ?? null, price ?? null
    ],
    (err, result) => {
      if (err) {
        console.error('insert error:', err);
        return res.status(400).json({ error: err.message });
      }
      return res.status(201).json({ message: 'created', id: result.insertId });
    }
  );
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  connection.query(
    'SELECT * FROM productorder WHERE proorder_id = ? LIMIT 1',
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json(rows[0]);
    }
  );
});

// (ตัวเลือก) GET /productorder/get-by-id?id=...
router.get('/get-by-id', (req, res) => {
  const id = Number(req.query.id);
  if (!id) return res.status(400).json({ error: 'id is required' });
  connection.query(
    'SELECT * FROM productorder WHERE proorder_id = ? LIMIT 1',
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ data: rows[0] });
    }
  );
});

// (ตัวเลือก) GET /productorder/read?id=...
// ถ้าอยากให้ /read แบบเดิมทำงานได้ทั้ง list และ single
router.get('/read', (req, res) => {
  const id = Number(req.query.id);
  if (id) {
    connection.query(
      'SELECT * FROM productorder WHERE proorder_id = ? LIMIT 1',
      [id],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
        return res.json({ data: rows[0] });
      }
    );
  } else {
    connection.query('SELECT * FROM productorder ORDER BY proorder_id DESC', (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ items: rows });
    });
  }
});

module.exports = router;
