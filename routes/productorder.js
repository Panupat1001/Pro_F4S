// routes/productorder.js
const express = require('express');
const router = express.Router();
const connection = require('../config/db');

const SORTABLE = new Set(['proorder_id', 'order_date', 'order_exp', 'order_quantity', 'price']);
const ORDER = new Set(['asc', 'desc']);

router.get('/list', (req, res) => {
  let { page = 1, pageSize = 10, q = '', sortField = 'order_date', sortOrder = 'desc' } = req.query;

  page = Math.max(1, parseInt(page, 10) || 1);
  pageSize = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10));
  sortField = SORTABLE.has(String(sortField)) ? String(sortField) : 'order_date';
  sortOrder = ORDER.has(String(sortOrder).toLowerCase()) ? String(sortOrder).toLowerCase() : 'desc';

  const offset = (page - 1) * pageSize;

  // filter: ถ้า q ไม่ว่างจะค้นหาใน order_lot หรือ proorder_id
  const whereSql = q ? `WHERE order_lot LIKE ? OR proorder_id LIKE ?` : '';
  const whereParams = q ? [`%${q}%`, `%${q}%`] : [];

  const countSql = `
    SELECT COUNT(*) AS total
    FROM productorder
    ${whereSql}
  `;

  const listSql = `
    SELECT 
      proorder_id,
      product_id,
      order_quantity,
      order_lot,
      order_date,
      order_exp,
      PH,
      color,
      smell,
      amount,
      price
    FROM productorder
    ${whereSql}
    ORDER BY ${sortField} ${sortOrder}
    LIMIT ? OFFSET ?
  `;

  connection.query(countSql, whereParams, (err1, rows1) => {
    if (err1) {
      console.error('count error:', err1);
      return res.status(500).json({ error: err1.message });
    }
    const total = rows1?.[0]?.total ?? 0;

    connection.query(listSql, [...whereParams, pageSize, offset], (err2, rows2) => {
      if (err2) {
        console.error('list error:', err2);
        return res.status(500).json({ error: err2.message });
      }
      return res.json({
        items: rows2 || [],
        total,
        page,
        pageSize,
      });
    });
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
