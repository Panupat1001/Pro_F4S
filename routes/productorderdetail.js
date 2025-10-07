const express = require('express');
const router = express.Router();
const connection = require('../config/db');

// ---- DEBUG helper: ตอบ error ให้ละเอียด ----
function sendDbError(res, err, where = '') {
  console.error(`[DB ERROR] ${where}:`, err);
  return res.status(500).json({
    error: 'db_error',
    where,
    code: err?.code,
    errno: err?.errno,
    sqlState: err?.sqlState,
    sqlMessage: err?.sqlMessage || err?.message,
  });
}

/* =========================
 * CREATE (เฉพาะ orderbuy) + DEBUG LOG
 * ========================= */
router.post('/create', (req, res) => {
  console.log('[POD/create] body =', req.body);

  const {
    chem_id,
    company_id,
    orderbuy,
    orderuse,
    chem_price,
    coa,
    msds,
    proorder_id,   // optional
    prodetail_id   // optional
  } = req.body || {};

  const chemId = Number(chem_id);
  const compId = company_id != null ? Number(company_id) : null;
  const buyQty = orderbuy != null ? Number(orderbuy) : null;
  const useQty = orderuse != null ? Number(orderuse) : null;
  const price  = chem_price != null ? Number(chem_price) : 0;

  if (!chemId) {
    return res.status(400).json({ error: 'ต้องระบุ chem_id' });
  }

  // โหมดสั่งซื้อจริง (ต้องมี company_id และ orderbuy > 0)
  const isBuyMode = Number.isFinite(buyQty) && buyQty > 0;

  // โหมดแจ้งความต้องการ (orderuse > 0) — ใช้ในหน้า productorder-detail.js
  const isUseMode = Number.isFinite(useQty) && useQty > 0;

  if (!isBuyMode && !isUseMode) {
    return res.status(400).json({ error: 'ต้องระบุ orderbuy (>0) หรือ orderuse (>0) อย่างใดอย่างหนึ่ง' });
  }

  if (isBuyMode && (!Number.isFinite(compId) || compId <= 0)) {
    return res.status(400).json({ error: 'กรุณาระบุ company_id เมื่อสั่งซื้อจริง (orderbuy)' });
  }

  // เตรียมคอลัมน์สำหรับ INSERT ตามโหมด
  const cols = ['chem_id', 'company_id', 'orderuse', 'orderbuy', 'chem_price', 'coa', 'msds', 'proorder_id', 'prodetail_id'];
  const vals = [
    chemId,
    isBuyMode ? compId : null,          // แจ้งความต้องการไม่บังคับบริษัท
    isUseMode ? useQty : 0,             // โหมดแจ้งความต้องการ
    isBuyMode ? buyQty : 0,             // โหมดสั่งซื้อจริง
    isBuyMode ? price : 0,              // แจ้งความต้องการยังไม่รู้ราคา
    coa ?? null,
    msds ?? null,
    proorder_id ?? null,
    prodetail_id ?? null
  ];

  const sql = `
    INSERT INTO productorderdetail (${cols.join(',')})
    VALUES (${cols.map(()=> '?').join(',')})
  `;

  connection.query(sql, vals, (err, result) => {
    if (err) {
      console.error('[POD/create] INSERT error:', err);
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ message: 'created', id: result?.insertId, mode: isBuyMode ? 'buy' : 'use' });
  });
});

/* =========================
 * READ (list + optional filters/search) — orderbuy only
 * ========================= */
router.get('/read', (req, res) => {
  const { q = '', proorder_id } = req.query;
  const params = [];
  const where = [];

  if (proorder_id) {
    where.push('pod.proorder_id = ?');
    params.push(Number(proorder_id));
  }
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
      pod.orderuse,      -- ✅ เพิ่มกลับมาเพื่อแสดงในตาราง
      pod.orderbuy,      -- ✅ ปริมาณที่สั่งซื้อ
      pod.chem_price,
      pod.coa,
      pod.msds,
      pod.company_id,
      pod.proorder_id,
      pod.prodetail_id
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
 * READ BY ID — orderbuy only
 * ========================= */
router.get('/read/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id is required' });

  const sql = `
    SELECT
      pod.pod_id,
      pod.chem_id,
      COALESCE(c.chem_name, CONCAT('[', pod.chem_id, ']')) AS chem_name,
      COALESCE(po.order_lot, '-') AS order_lot,
      COALESCE(cp.company_name, '-') AS company_name,
      pod.orderuse,      -- ✅ เพิ่มกลับมา
      pod.orderbuy,      -- ✅ แสดงทั้งคู่
      pod.chem_price,
      pod.coa,
      pod.msds,
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
    if (!rows || rows.length === 0)
      return res.status(404).json({ message: 'not found' });
    res.json(rows[0]);
  });
});

/* =========================
 * UPDATE (เฉพาะ orderbuy) 
 *  → คำนวณราคา/กรัม (price_gram)
 *  → อัปเดต chem.price_gram และ chem.chem_quantity
 * ========================= */
// routes/productorderdetail.js
// routes/productorderdetail.js (เฉพาะ handler PUT /productorderdetail/update)
router.put('/update', (req, res) => {
  const { pod_id, chem_id, company_id, orderbuy, chem_price, coa, msds } = req.body || {};

  const podId      = Number(pod_id);
  const chemId     = Number(chem_id);
  const compId     = Number(company_id);
  const buyQty     = Number(orderbuy);
  const totalPrice = Number(chem_price);

  // คำนวณราคา/กรัม (ไว้ไปตั้งใน chem.price_gram)
  const unitPrice = (Number.isFinite(buyQty) && buyQty > 0)
    ? Math.round((totalPrice / buyQty) * 100) / 100
    : 0;

  // ตรวจอินพุตขั้นต่ำ
  if (!podId || !chemId || !compId || !Number.isFinite(buyQty) || buyQty <= 0) {
    return res.status(400).json({ error: 'ข้อมูลไม่ครบ หรือ orderbuy ต้อง > 0' });
  }

  connection.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: err.message });

    // 1) อัปเดตรายการใน productorderdetail (ตัด updated_at ออก และไม่ยุ่ง price_gram)
    const sqlUpdPOD = `
      UPDATE productorderdetail
      SET company_id = ?,
          orderbuy   = ?,
          chem_price = ?,
          coa        = ?,
          msds       = ?
      WHERE pod_id = ? AND chem_id = ?
      LIMIT 1
    `;
    const podParams = [
      compId,
      buyQty,
      totalPrice,
      (coa ?? null),
      (msds ?? null),
      podId,
      chemId
    ];

    connection.query(sqlUpdPOD, podParams, (e1, r1) => {
      if (e1) {
        return connection.rollback(() => res.status(500).json({ error: e1.message }));
      }
      if (!r1.affectedRows) {
        return connection.rollback(() => res.status(404).json({ error: 'ไม่พบรายการที่ต้องการอัปเดต' }));
      }

      // 2) เพิ่มสต๊อก + ตั้งราคา/กรัม ที่ตาราง chem
      const sqlUpdChem = `
        UPDATE chem
        SET price_gram    = ?,
            chem_quantity = COALESCE(chem_quantity, 0) + ?
        WHERE chem_id = ?
        LIMIT 1
      `;
      connection.query(sqlUpdChem, [unitPrice, buyQty, chemId], (e2, r2) => {
        if (e2) {
          return connection.rollback(() => res.status(500).json({ error: e2.message }));
        }
        if (!r2.affectedRows) {
          return connection.rollback(() => res.status(404).json({ error: 'ไม่พบสารเคมีที่ต้องการอัปเดต' }));
        }

        // 3) ดึงค่าล่าสุดส่งกลับ (ถ้าอยากใช้แสดงผลหน้าเว็บ)
        const sqlGetChem = `
          SELECT chem_id, chem_quantity, price_gram
          FROM chem
          WHERE chem_id = ?
          LIMIT 1
        `;
        connection.query(sqlGetChem, [chemId], (e3, rows3) => {
          if (e3) {
            return connection.rollback(() => res.status(500).json({ error: e3.message }));
          }

          connection.commit((e4) => {
            if (e4) {
              return connection.rollback(() => res.status(500).json({ error: e4.message }));
            }
            return res.json({
              message: 'อัปเดตการสั่งซื้อสำเร็จ และเพิ่มสต๊อกเรียบร้อย',
              productorderdetail: {
                pod_id: podId,
                chem_id: chemId,
                company_id: compId,
                orderbuy: buyQty,
                chem_price: totalPrice,
                coa: coa ?? null,
                msds: msds ?? null
              },
              chem: rows3?.[0] ?? null
            });
          });
        });
      });
    });
  });
});



module.exports = router;
