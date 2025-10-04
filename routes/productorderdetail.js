// routes/productorderdetail.js
const express = require('express');
const router = express.Router();
const connection = require('../config/db');

// routes/productorderdetail.js
router.post('/create', (req, res) => {
  let {
    prodetail_id, // ไม่ใช้
    chem_id,
    proorder_id,   // อาจเป็น null ได้
    company_id,
    orderuse,
    orderbuy,
    chem_price,
    coa,
    msds
  } = req.body || {};

  if (!chem_id || !Number.isFinite(Number(orderuse))) {
    return res.status(400).json({ error: 'chem_id และ orderuse จำเป็นต้องมี' });
  }

  const useQty = Number(orderuse);
  const buyQty = Number.isFinite(Number(orderbuy)) ? Number(orderbuy) : useQty;
  const unitPrice = Number.isFinite(Number(chem_price)) ? Number(chem_price) :
                    (useQty > 0 ? (buyQty / useQty) : 0);

  // ✅ INSERT เสมอ (ไม่เช็คซ้ำ ไม่บวกเพิ่ม)
  const sqlInsert = `
    INSERT INTO productorderdetail
      (chem_id, proorder_id, company_id, orderuse, orderbuy, chem_price, coa, msds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    chem_id,
    proorder_id ?? null,    // ให้เป็น NULL ได้
    company_id || null,
    useQty,
    buyQty,
    unitPrice,
    coa || null,
    msds || null
  ];

  connection.query(sqlInsert, params, (err, result) => {
    if (err) {
      console.error('[productorderdetail create] INSERT error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    return res.json({ id: result.insertId, message: 'created' });
  });
});


/* =========================
 * READ (list + optional filters/search)
 * คืนค่าเป็นคอลัมน์:
 * chem_id(เพิ่มให้), chem_name, order_lot, company_name, orderuse, chem_price, orderbuy, coa, msds (+ pod_id)
 * ========================= */
router.get('/read', (req, res) => {
  const { q = '', proorder_id } = req.query;

  const params = [];
  const where = [];

  if (proorder_id) { where.push('pod.proorder_id = ?'); params.push(Number(proorder_id)); }
  if (q) {
    const like = `%${q}%`;
    where.push('(c.chem_name LIKE ? OR po.order_lot LIKE ? OR cp.company_name LIKE ?)');
    params.push(like, like, like);
  }

  const sql = `
    SELECT
      pod.pod_id,
      pod.chem_id,                                           -- ✅ ส่ง chem_id ออกไปให้ index ใช้ทำลิงก์สั่งซื้อ
      COALESCE(c.chem_name, CONCAT('[', pod.chem_id, ']')) AS chem_name,
      COALESCE(po.order_lot, '-')                          AS order_lot,
      COALESCE(cp.company_name, '-')                       AS company_name,
      pod.orderuse,
      pod.chem_price,
      pod.orderbuy,
      pod.coa,
      pod.msds
    FROM productorderdetail pod
    LEFT JOIN chem         c  ON c.chem_id      = pod.chem_id
    LEFT JOIN productorder po ON po.proorder_id = pod.proorder_id
    LEFT JOIN company      cp ON cp.company_id  = pod.company_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY pod.pod_id DESC
  `;

  connection.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});


/* =========================
 * READ BY ID (join เหมือนกัน)
 * ========================= */
router.get('/read/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id is required' });

  const sql = `
    SELECT
      pod.pod_id,
      COALESCE(c.chem_name, CONCAT('[', pod.chem_id, ']')) AS chem_name,
      COALESCE(po.order_lot, '-')                          AS order_lot,
      COALESCE(cp.company_name, '-')                       AS company_name,
      pod.orderuse,
      pod.chem_price,
      pod.orderbuy,
      pod.coa,
      pod.msds,
      -- id อ้างอิงเพื่อหน้าแก้ไข
      pod.chem_id,
      pod.proorder_id,
      pod.company_id,
      pod.prodetail_id
    FROM productorderdetail pod
    LEFT JOIN chem         c  ON c.chem_id      = pod.chem_id
    LEFT JOIN productorder po ON po.proorder_id = pod.proorder_id
    LEFT JOIN company      cp ON cp.company_id  = pod.company_id
    WHERE pod.pod_id = ?
    LIMIT 1
  `;
  connection.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows || rows.length === 0) return res.status(404).json({ message: 'not found' });
    res.json(rows[0]);
  });
});


/* =========================
 * READ BY ORDER (รายการในใบสั่งผลิตเดียว)
 * ========================= */
router.get('/by-order/:proorderId', (req, res) => {
  const proorderId = Number(req.params.proorderId);
  if (!proorderId) return res.status(400).json({ error: 'proorderId is required' });

  const sql = `
    SELECT
      pod.pod_id,
      COALESCE(c.chem_name, CONCAT('[', pod.chem_id, ']')) AS chem_name,
      COALESCE(po.order_lot, '-')                          AS order_lot,
      COALESCE(cp.company_name, '-')                       AS company_name,
      pod.orderuse,
      pod.chem_price,
      pod.orderbuy,
      pod.coa,
      pod.msds
    FROM productorderdetail pod
    LEFT JOIN chem         c  ON c.chem_id      = pod.chem_id
    LEFT JOIN productorder po ON po.proorder_id = pod.proorder_id
    LEFT JOIN company      cp ON cp.company_id  = pod.company_id
    WHERE pod.proorder_id = ?
    ORDER BY pod.pod_id ASC
  `;
  connection.query(sql, [proorderId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});


/* =========================
 * UPDATE
 * ========================= */
router.patch('/update/:id', (req, res) => {
  const id = req.params.id;
  const {
    prodetail_id,
    chem_id,
    proorder_id,
    company_id,
    orderuse,
    orderbuy,
    chem_price,
    coa,
    msds
  } = req.body;

  connection.query(
    `UPDATE productorderdetail SET
      prodetail_id = ?, chem_id = ?, proorder_id = ?, company_id = ?,
      orderuse = ?, orderbuy = ?, chem_price = ?, coa = ?, msds = ?
     WHERE pod_id = ?`,
    [prodetail_id, chem_id, proorder_id, company_id, orderuse, orderbuy, chem_price, coa, msds, id],
    (err) => {
      if (err) return res.status(400).json({ error: err.message });
      res.status(200).json({ message: "ProductOrderDetail updated successfully" });
    }
  );
});


/* =========================
 * DELETE
 * ========================= */
router.delete('/delete/:id', (req, res) => {
  const id = req.params.id;
  connection.query(
    "DELETE FROM productorderdetail WHERE pod_id = ?",
    [id],
    (err, result) => {
      if (err) return res.status(400).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ message: "ProductOrderDetail not found" });
      res.status(200).json({ message: "ProductOrderDetail deleted successfully" });
    }
  );
});

// routes/productorderdetail.js (เฉพาะส่วนเพิ่มเติม / ปรับปรุง)

// ----- [A] เพิ่ม endpoint: /productorderdetail/chems?product_id=XXX -----
// ใช้โครง JOIN เดียวกับ /list แบบ product_id
router.get('/chems', (req, res) => {
  const productId = Number(req.query.product_id);
  if (!productId) return res.status(400).json({ error: 'product_id is required' });

  const sql = `
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
  connection.query(sql, [productId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ items: rows || [] });
  });
});


// ----- [B] ปรับ /list ให้รองรับทั้ง product_id และ proorder_id -----
router.get('/list', (req, res) => {
  const productId  = Number(req.query.product_id);
  const proorderId = Number(req.query.proorder_id);

  // ถ้ามี proorder_id → แปลงไปหา product_id ของออเดอร์นั้นก่อน
  const runByOrder = () => {
    const sqlOrder = `
      SELECT product_id
      FROM productorder
      WHERE proorder_id = ?
      LIMIT 1
    `;
    connection.query(sqlOrder, [proorderId], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Order not found' });
      runByProduct(Number(rows[0].product_id));
    });
  };

  const runByProduct = (pid) => {
    const sql = `
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
    connection.query(sql, [pid], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ items: rows || [] });
    });
  };

  if (proorderId) return runByOrder();
  if (productId)  return runByProduct(productId);
  return res.status(400).json({ error: 'ต้องระบุ product_id หรือ proorder_id อย่างน้อยหนึ่งค่า' });
});


// ----- [C] ปรับ /read ให้รองรับ ?product_id หรือ ?proorder_id (เดิมคุณรองรับเฉพาะ q, proorder_id) -----
router.get('/read', (req, res) => {
  const podId      = Number(req.query.pod_id);
  const productId  = Number(req.query.product_id);
  const proorderId = Number(req.query.proorder_id);
  const q          = (req.query.q || '').trim();

  if (podId) {
    const sql1 = `
      SELECT
        pod.pod_id,
        COALESCE(c.chem_name, CONCAT('[', pod.chem_id, ']')) AS chem_name,
        COALESCE(po.order_lot, '-') AS order_lot,
        COALESCE(cp.company_name, '-') AS company_name,
        pod.orderuse,
        pod.chem_price,
        pod.orderbuy,
        pod.coa,
        pod.msds,
        pod.chem_id,
        pod.proorder_id,
        pod.company_id,
        pod.prodetail_id
      FROM productorderdetail pod
      LEFT JOIN chem         c  ON c.chem_id      = pod.chem_id
      LEFT JOIN productorder po ON po.proorder_id = pod.proorder_id
      LEFT JOIN company      cp ON cp.company_id  = pod.company_id
      WHERE pod.pod_id = ?
      LIMIT 1
    `;
    return connection.query(sql1, [podId], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!rows || rows.length === 0) return res.status(404).json({ message: 'not found' });
      return res.json(rows[0]);
    });
  }

  // ถ้ามี product_id/proorder_id → คืนรายการตามใบสั่ง/สินค้า
  if (productId || proorderId) {
    req.url = productId
      ? `/list?product_id=${productId}`
      : `/list?proorder_id=${proorderId}`;
    return router.handle(req, res);
  }

  // ถ้าไม่มีตัวกรอง → ใช้รูปแบบ join เดิม + รองรับ q
  const params = [];
  const where  = [];
  if (q) {
    const like = `%${q}%`;
    where.push('(c.chem_name LIKE ? OR po.order_lot LIKE ? OR cp.company_name LIKE ?)');
    params.push(like, like, like);
  }

  const sql = `
    SELECT
      pod.pod_id,
      pod.chem_id,
      COALESCE(c.chem_name, CONCAT('[', pod.chem_id, ']')) AS chem_name,
      COALESCE(po.order_lot, '-') AS order_lot,
      COALESCE(cp.company_name, '-') AS company_name,
      pod.orderuse,
      pod.chem_price,
      pod.orderbuy,
      pod.coa,
      pod.msds
    FROM productorderdetail pod
    LEFT JOIN chem         c  ON c.chem_id      = pod.chem_id
    LEFT JOIN productorder po ON po.proorder_id = pod.proorder_id
    LEFT JOIN company      cp ON cp.company_id  = pod.company_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY pod.pod_id DESC
  `;
  connection.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

module.exports = router;
