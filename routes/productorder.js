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
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { product_id } = rows[0];
    if (!product_id) return res.status(400).json({ error: 'Order has no product_id' });

    // ✅ ใช้คอลัมน์จริงจากตาราง productdetail + chem
    const sqlChems = `
      SELECT
        pd.prodetail_id,
        pd.product_id,
        pd.chem_id,
        pd.chem_percent,
        c.chem_name,
        c.inci_name,
        c.chem_quantity,
        c.chem_unit
      FROM productdetail pd
      LEFT JOIN chem c ON c.chem_id = pd.chem_id
      WHERE pd.product_id = ?
      ORDER BY pd.prodetail_id ASC
    `;

    connection.query(sqlChems, [product_id], (err2, rows2) => {
      if (err2) {
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

  // รองรับการ sort
  const sortField = (req.query.sortField || 'order_date').trim();
  const sortOrder = (req.query.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // map ชื่อ field ที่อนุญาตให้ sort
  const allowedSort = {
    product_name: 'p.product_name',
    order_lot: 'po.order_lot',
    order_date: 'po.order_date',
    order_exp: 'po.order_exp',
    proorder_id: 'po.proorder_id'
  };
  const sortBy = allowedSort[sortField] || 'po.order_date';

  const params = [];
  let where = '';
  if (q) {
    const like = `%${q}%`;
    where = `
      WHERE
        p.product_name LIKE ? OR
        po.order_lot   LIKE ? OR
        po.proorder_id LIKE ? OR
        DATE_FORMAT(po.order_date, '%Y-%m-%d') LIKE ? OR
        DATE_FORMAT(po.order_exp,  '%Y-%m-%d') LIKE ?
    `;
    // หมายเหตุ: ถ้า proorder_id เป็นตัวเลขล้วน
    // การใช้ LIKE กับคอลัมน์ตัวเลขใน MySQL อาจต้อง CAST:
    //   CAST(po.proorder_id AS CHAR) LIKE ?
    params.push(like, like, like, like, like);
  }

  // ✅ SQL สำหรับ list ใบสั่งผลิต (join ชื่อสินค้า)
  const sql = `
    SELECT
      po.proorder_id,
      po.product_id,
      p.product_name,
      po.order_lot,
      po.order_date,
      po.order_exp,
      po.order_quantity,
      po.price,
      po.PH,
      po.color,
      po.smell,
      po.amount
    FROM productorder po
    LEFT JOIN product p ON p.product_id = po.product_id
    ${where}
    ORDER BY ${sortBy} ${sortOrder}
  `;

  connection.query(sql, params, (err, rows) => {
    if (err) {
      console.log('List productorder error:', err);
      return res.status(400).json({ error: err.message });
    }
    res.json({ items: rows || [] });
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

router.put('/produce/:proorder_id', (req, res) => {
  const proorderId = Number(req.params.proorder_id);
  if (!proorderId) return res.status(400).json({ error: 'proorder_id is required' });

  connection.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: err.message });

    // 1) ดึงสารเคมีทั้งหมดในสูตรของ order นี้
    const sqlGetChem = `
      SELECT pod.chem_id, pod.orderuse AS qty, c.price_gram
      FROM productorderdetail pod
      JOIN chem c ON c.chem_id = pod.chem_id
      WHERE pod.proorder_id = ?
    `;

    connection.query(sqlGetChem, [proorderId], (e1, rows) => {
      if (e1) return connection.rollback(() => res.status(500).json({ error: e1.message }));

      if (!rows || rows.length === 0)
        return connection.rollback(() => res.status(404).json({ error: 'ไม่พบสูตรของคำสั่งผลิตนี้' }));

      // 2) คำนวณราคารวม
      let total = 0;
      for (const r of rows) {
        const qty = Number(r.qty) || 0;
        const priceGram = Number(r.price_gram) || 0;
        total += qty * priceGram;
      }

      // 3) อัปเดตราคา + status
      const sqlUpdate = `
        UPDATE productorder
        SET price = ?, status = 1
        WHERE proorder_id = ?
      `;
      connection.query(sqlUpdate, [total, proorderId], (e2) => {
        if (e2) return connection.rollback(() => res.status(500).json({ error: e2.message }));

        connection.commit((e3) => {
          if (e3) return connection.rollback(() => res.status(500).json({ error: e3.message }));
          res.json({ message: 'อัปเดตราคาสำเร็จ', total_price: total });
        });
      });
    });
  });
});

module.exports = router;
