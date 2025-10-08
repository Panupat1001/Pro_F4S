// routes/productorder.js
const express = require('express');
const router = express.Router();
const connection = require('../config/db');

/// ---------- helpers ----------
const toNull = v => (v === '' || v === undefined ? null : v);
const toFloatOrNull = v => { v = toNull(v); if (v===null) return null; const n=Number(v); return Number.isFinite(n)?n:undefined; };
const toIntOrNull   = v => { v = toNull(v); if (v===null) return null; const n=Number(v); return Number.isFinite(n)?Math.trunc(n):undefined; };
const toTinyOrNull  = v => {
  v = toNull(v); if (v===null) return null;
  const s = String(v).toLowerCase();
  if (['1','true','yes','on'].includes(s)) return 1;
  if (['0','false','no','off'].includes(s)) return 0;
  const n = Number(v); if (n===0 || n===1) return n;
  return undefined;
};

/// ---------- GET /:id/chems (วางเหนือ /:id เสมอ) ----------
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

    const sqlChems = `
      SELECT
        pd.prodetail_id, pd.product_id, pd.chem_id, pd.chem_percent,
        c.chem_name, c.inci_name, c.chem_quantity, c.chem_unit,
        c.price_gram AS chem_price_gram
      FROM productdetail pd
      LEFT JOIN chem c ON c.chem_id = pd.chem_id
      WHERE pd.product_id = ?
      ORDER BY pd.prodetail_id ASC
    `;
    connection.query(sqlChems, [product_id], (err2, rows2) => {
      if (err2) {
        console.error('[order chems] SELECT chems error:', err2.code, err2.sqlMessage || err2.message);
        return res.status(500).json({ error: err2.message });
      }
      res.json({ items: rows2 || [] });
    });
  });
});

/// ---------- PUT /:id (อัปเดต PH, color, smell, amount) ----------
function doUpdate(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });

  const b = req.body || {};
  const updates = [], params = [];

  if ('PH'     in b) { const v=toFloatOrNull(b.PH);     if (v===undefined)  return res.status(400).json({ error:'PH must be number or null' });     updates.push('PH=?');     params.push(v); }
  if ('color'  in b) { const v=toTinyOrNull(b.color);   if (v===undefined)  return res.status(400).json({ error:'color must be 0/1 or null' });   updates.push('color=?');  params.push(v); }
  if ('smell'  in b) { const v=toTinyOrNull(b.smell);   if (v===undefined)  return res.status(400).json({ error:'smell must be 0/1 or null' });   updates.push('smell=?');  params.push(v); }
  if ('amount' in b) { const v=toIntOrNull(b.amount);   if (v===undefined)  return res.status(400).json({ error:'amount must be int or null' });  updates.push('amount=?'); params.push(v); }

  if (!updates.length) return res.status(400).json({ error: 'no valid fields to update' });

  const sql = `UPDATE productorder SET ${updates.join(', ')} WHERE proorder_id=? LIMIT 1`;
  params.push(id);

  connection.query(sql, params, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.query(
      `SELECT proorder_id AS id, PH, color, smell, amount, status FROM productorder WHERE proorder_id=? LIMIT 1`,
      [id],
      (e2, rows) => {
        if (e2) return res.status(200).json({ updated: true, affectedRows: result.affectedRows });
        res.json({ updated: true, affectedRows: result.affectedRows, item: rows?.[0] || null });
      }
    );
  });
}
router.put('/:id', doUpdate);
router.put('/update/:id', doUpdate); // เผื่อคุณยิงแบบ /productorder/update/:id

/// ---------- GET /list ----------
router.get('/list', (req, res) => {
  const q = (req.query.q || '').trim();

  // sort
  const sortField = (req.query.sortField || 'order_date').trim();
  const sortOrder = (req.query.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
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
        CAST(po.proorder_id AS CHAR) LIKE ? OR
        DATE_FORMAT(po.order_date, '%Y-%m-%d') LIKE ? OR
        DATE_FORMAT(po.order_exp,  '%Y-%m-%d') LIKE ?
    `;
    params.push(like, like, like, like, like);
  }

  const sql = `
    SELECT
      po.proorder_id, po.product_id, p.product_name,
      po.order_lot, po.order_date, po.order_exp,
      po.order_quantity, po.price,
      po.PH, po.color, po.smell, po.amount,
      po.status
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

/// ---------- CREATE ----------
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

/// ---------- READ by id ----------
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

/// ---------- PRODUCE (คำนวณราคา + set status=1) ----------
router.put('/produce/:proorder_id', (req, res) => {
  const proorderId = Number(req.params.proorder_id);
  if (!Number.isFinite(proorderId) || proorderId <= 0) {
    return res.status(400).json({ error: 'proorder_id is required' });
  }

  const sqlTotal = `
    SELECT
      SUM(
        (
          CASE
            WHEN COALESCE(pd.chem_percent,0) > 0 AND COALESCE(pd.chem_percent,0) <= 1
              THEN pd.chem_percent * 100
            ELSE COALESCE(pd.chem_percent,0)
          END
        ) * COALESCE(po.order_quantity,0) * 0.01
        * COALESCE(c.price_gram,0)
      ) AS total_price,
      COUNT(*) AS line_count
    FROM productorder po
    JOIN productdetail pd ON pd.product_id = po.product_id
    JOIN chem c           ON c.chem_id     = pd.chem_id
    WHERE po.proorder_id = ?
  `;

  connection.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: err.message });

    connection.query(sqlTotal, [proorderId], (e1, r1) => {
      if (e1) return connection.rollback(() => res.status(500).json({ error: e1.message }));

      const total = Number(r1?.[0]?.total_price || 0);

      const sqlUpdate = `
        UPDATE productorder
        SET price = ROUND(?, 2), status = 1
        WHERE proorder_id = ?
      `;
      connection.query(sqlUpdate, [total, proorderId], (e2, r2) => {
        if (e2) return connection.rollback(() => res.status(500).json({ error: e2.message }));
        if (r2.affectedRows === 0) {
          return connection.rollback(() => res.status(404).json({ error: 'productorder not found' }));
        }

        connection.commit((e3) => {
          if (e3) return connection.rollback(() => res.status(500).json({ error: e3.message }));
          res.json({
            ok: true,
            message: 'อัปเดตราคาและสถานะเรียบร้อย',
            total_price: Number(total.toFixed(2)),
          });
        });
      });
    });
  });
});

module.exports = router;
