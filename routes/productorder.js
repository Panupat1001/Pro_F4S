// routes/productorder.js
const express = require('express');
const router = express.Router();
const connection = require('../config/db');

const SORTABLE = new Set(['proorder_id', 'order_date', 'order_exp', 'order_quantity', 'price']);
const ORDER = new Set(['asc', 'desc']);

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

module.exports = router;
