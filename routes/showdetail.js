// routes/showdetail.js
const express = require('express');
const router = express.Router();
const connection = require('../config/db');

const TABLE_PO = 'productorder';
const COL_ID = 'proorder_id';
const TABLE_PRODUCT = 'product';
const TABLE_BRAND = 'brand';

// ======================================
// ✅ GET /showdetail/materials
// ======================================
router.get('/materials', (req, res) => {
  const proorderId = Number(req.query.proorder_id || req.query.id);
  if (!proorderId) {
    return res.status(400).json({ error: 'proorder_id is required' });
  }

  // 1) หาว่าใบสั่งผลิตนี้ใช้ product_id อะไร
  const sqlProduct = `SELECT product_id, order_quantity FROM ${TABLE_PO} WHERE ${COL_ID} = ? LIMIT 1`;
  connection.query(sqlProduct, [proorderId], (err1, row1) => {
    if (err1) {
      console.error('[GET /showdetail/materials] error step1:', err1);
      return res.status(500).json({ error: err1.message });
    }
    if (!row1 || row1.length === 0) {
      return res.status(404).json({ error: 'productorder not found' });
    }

    const productId = row1[0].product_id;
    const orderQty = Number(row1[0].order_quantity || 0);

    // 2) ดึงสูตรจาก productdetail + chem
    const sql = `
      SELECT
        pd.chem_id,
        c.chem_name,
        c.inci_name,
        c.price_gram AS unit_price,
        pd.chem_percent,
        (pd.chem_percent * ? * 0.01) AS use_quantity,
        ((pd.chem_percent * ? * 0.01) * IFNULL(c.price_gram, 0)) AS sum_price
      FROM productdetail pd
      LEFT JOIN chem c ON c.chem_id = pd.chem_id
      WHERE pd.product_id = ?
      ORDER BY pd.prodetail_id ASC
    `;
    connection.query(sql, [orderQty, orderQty, productId], (err2, rows) => {
      if (err2) {
        console.error('[GET /showdetail/materials] error step2:', err2);
        return res.status(500).json({ error: err2.message });
      }
      res.json(rows || []);
    });
  });
});

// ======================================
// GET /showdetail/list
// ======================================
router.get('/list', (req, res) => {
  const {
    q = '',
    page = '1',
    pageSize = '50',
    sortField = 'id',
    sortOrder = 'desc',
  } = req.query || {};

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const sizeNum = Math.max(1, Math.min(500, parseInt(pageSize, 10) || 50));
  const hasQ = typeof q === 'string' && q.trim() !== '';
  const qLike = hasQ ? `%${q.trim()}%` : null;

  const sortMap = {
    id:             `po.${COL_ID}`,
    product_name:   'p.product_name',
    brand_name:     'b.brand_name',
    product_code:   'p.product_id',
    order_lot:      'po.order_lot',
    order_date:     'po.order_date',
    order_exp:      'po.order_exp',
    amount:         'po.amount',
    price:          'po.price',
    status:         'po.status',
  };
  const sf = sortMap[sortField] || `po.${COL_ID}`;
  const so = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const baseSelect = `
    FROM ${TABLE_PO} po
    LEFT JOIN ${TABLE_PRODUCT} p ON p.product_id = po.product_id
    LEFT JOIN ${TABLE_BRAND}   b ON b.brand_id   = p.brand_id
  `;

  const whereSql = hasQ
    ? `WHERE po.status = 1 AND (p.product_name LIKE ? OR b.brand_name LIKE ? OR po.order_lot LIKE ? OR p.product_id LIKE ?)`
    : `WHERE po.status = 1`;

  const countSql = `
    SELECT COUNT(*) AS total
    ${baseSelect}
    ${whereSql}
  `;

  const dataSql = `
    SELECT
      po.${COL_ID} AS id,
      po.product_id,
      p.product_id AS product_code,
      p.product_name,
      b.brand_name,
      COALESCE(p.product_picture1, p.product_picture2, p.product_picture3, '') AS product_image,
      po.order_quantity,
      po.order_lot,
      po.order_date,
      po.order_exp,
      po.PH,
      po.color,
      po.smell,
      po.amount,
      po.price,
      po.status
    ${baseSelect}
    ${whereSql}
    ORDER BY ${sf} ${so}, po.${COL_ID} DESC
    LIMIT ? OFFSET ?
  `;

  const paramsCount = [];
  const paramsData  = [];
  if (hasQ) {
    paramsCount.push(qLike, qLike, qLike, qLike);
    paramsData .push(qLike, qLike, qLike, qLike);
  }
  paramsData.push(sizeNum, (pageNum - 1) * sizeNum);

  connection.query(countSql, paramsCount, (e1, r1) => {
    if (e1) {
      console.error('[GET /showdetail/list] count error:', e1);
      return res.status(500).json({ message: 'database error (count)', detail: e1.message });
    }
    const total = r1?.[0]?.total ?? 0;

    connection.query(dataSql, paramsData, (e2, rows) => {
      if (e2) {
        console.error('[GET /showdetail/list] data error:', e2);
        return res.status(500).json({ message: 'database error (data)', detail: e2.message });
      }

      const items = (rows || []).map(r => ({
        id:             r.id,
        product_id:     r.product_id,
        product_code:   r.product_code,
        product_name:   r.product_name ?? '-',
        brand_name:     r.brand_name ?? '-',
        product_image:  r.product_image ? String(r.product_image) : '',
        order_quantity: r.order_quantity ?? 0,
        order_lot:      r.order_lot ?? '',
        order_date:     r.order_date,
        order_exp:      r.order_exp,
        PH:             r.PH,
        color:          r.color,
        smell:          r.smell,
        amount:         r.amount ?? 0,
        price:          r.price ?? 0,
        status:         r.status,
      }));

      res.json({ items, total, page: pageNum, pageSize: sizeNum });
    });
  });
});

// ======================================
// ✅ GET /showdetail/:id
// ======================================
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'invalid id' });
  }

  const sql = `
    SELECT
      po.${COL_ID} AS id,
      po.product_id,
      p.product_id AS product_code,
      p.product_name,
      b.brand_name,
      COALESCE(p.product_picture1, p.product_picture2, p.product_picture3, '') AS product_image,
      po.order_quantity,
      po.order_lot,
      po.order_date,
      po.order_exp,
      po.PH,
      po.color,
      po.smell,
      po.amount,
      po.price,
      po.status
    FROM ${TABLE_PO} po
    LEFT JOIN ${TABLE_PRODUCT} p ON p.product_id = po.product_id
    LEFT JOIN ${TABLE_BRAND} b ON b.brand_id = p.brand_id
    WHERE po.${COL_ID} = ? AND po.status = 1
    LIMIT 1
  `;

  connection.query(sql, [id], (err, rows) => {
    if (err) {
      console.error('[GET /showdetail/:id] error:', err);
      return res.status(500).json({ message: 'database error', detail: err.message });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'not found' });
    }

    const r = rows[0];
    res.json({
      id:             r.id,
      product_id:     r.product_id,
      product_code:   r.product_code,
      product_name:   r.product_name ?? '-',
      brand_name:     r.brand_name ?? '-',
      product_image:  r.product_image ? String(r.product_image) : '',
      order_quantity: r.order_quantity ?? 0,
      order_lot:      r.order_lot ?? '',
      order_date:     r.order_date,
      order_exp:      r.order_exp,
      PH:             r.PH,
      color:          r.color,
      smell:          r.smell,
      amount:         r.amount ?? 0,
      price:          r.price ?? 0,
      status:         r.status,
    });
  });
});

// ======================================
// ✅ PUT /productorder/:id
// อัปเดตฟิลด์ PH, color, smell, amount ของตาราง productorder
// body: { PH?: number|null, color?: 0|1|null, smell?: 0|1|null, amount?: number|null }
// ======================================
router.put('/productorder/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'invalid id' });
  }

  // แปลงค่าที่รับมาให้ปลอดภัย/ถูกประเภท
  const b = req.body || {};

  const toNullIfEmpty = (v) => (v === '' || v === undefined ? null : v);
  const toFloatOrNull = (v) => {
    v = toNullIfEmpty(v);
    if (v === null) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return undefined; // undefined = invalid
    return n;
  };
  const toIntOrNull = (v) => {
    v = toNullIfEmpty(v);
    if (v === null) return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return undefined;
    return Math.trunc(n);
  };
  const toTinyOrNull = (v) => {
    v = toNullIfEmpty(v);
    if (v === null) return null;
    const s = String(v).toLowerCase();
    if (['1','true','yes','on'].includes(s)) return 1;
    if (['0','false','no','off'].includes(s)) return 0;
    const n = Number(v);
    if (n === 0 || n === 1) return n;
    return undefined; // invalid
  };

  // เตรียมฟิลด์ที่จะอัปเดต (อัปเดตเฉพาะที่ส่งมาเท่านั้น)
  const updates = [];
  const params  = [];

  if ('PH' in b) {
    const ph = toFloatOrNull(b.PH);
    if (ph === undefined) return res.status(400).json({ error: 'PH must be a number or null' });
    updates.push('PH = ?'); params.push(ph);
  }
  if ('color' in b) {
    const color = toTinyOrNull(b.color);
    if (color === undefined) return res.status(400).json({ error: 'color must be 0,1 or null' });
    updates.push('color = ?'); params.push(color);
  }
  if ('smell' in b) {
    const smell = toTinyOrNull(b.smell);
    if (smell === undefined) return res.status(400).json({ error: 'smell must be 0,1 or null' });
    updates.push('smell = ?'); params.push(smell);
  }
  if ('amount' in b) {
    const amount = toIntOrNull(b.amount);
    if (amount === undefined) return res.status(400).json({ error: 'amount must be an integer or null' });
    updates.push('amount = ?'); params.push(amount);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'no valid fields to update' });
  }

  const sql = `UPDATE ${TABLE_PO} SET ${updates.join(', ')} WHERE ${COL_ID} = ? LIMIT 1`;
  params.push(id);

  connection.query(sql, params, (err, result) => {
    if (err) {
      console.error('[PUT /productorder/:id] error:', err);
      return res.status(500).json({ error: err.message });
    }
    // ส่งข้อมูลหลังอัปเดตกลับ (อ่านซ้ำ 1 ครั้ง)
    const sqlRead = `SELECT ${COL_ID} AS id, PH, color, smell, amount FROM ${TABLE_PO} WHERE ${COL_ID} = ? LIMIT 1`;
    connection.query(sqlRead, [id], (e2, rows) => {
      if (e2) return res.status(200).json({ updated: true, affectedRows: result.affectedRows });
      res.json({ updated: true, affectedRows: result.affectedRows, item: rows?.[0] || null });
    });
  });
});

module.exports = router;
