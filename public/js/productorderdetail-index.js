// routes/productorderdetail.js
const express = require('express');
const router = express.Router();
const connection = require('../config/db');

// ---------- CREATE (เหมือนเดิม) ----------
router.post('/create', (req, res) => {
  let {
    prodetail_id,
    chem_id,
    proorder_id,
    company_id,
    orderuse,
    orderbuy,
    chem_price,
    coa,
    msds
  } = req.body || {};

  if (!chem_id || !proorder_id || !Number.isFinite(Number(orderuse))) {
    return res.status(400).json({ error: 'proorder_id, chem_id, orderuse are required' });
  }

  proorder_id = Number(proorder_id);
  const useQty = Number(orderuse);
  const buyQty = Number.isFinite(Number(orderbuy)) ? Number(orderbuy) : useQty;

  const sqlFind = `
    SELECT pod_id, orderuse, orderbuy
    FROM productorderdetail
    WHERE proorder_id = ? AND chem_id = ?
    LIMIT 1
  `;
  connection.query(sqlFind, [proorder_id, chem_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    if (rows && rows.length) {
      const row = rows[0];
      const newUse = Number(row.orderuse || 0) + useQty;
      const newBuy = Number(row.orderbuy || 0) + buyQty;

      const sqlUpdate = `
        UPDATE productorderdetail
        SET
          orderuse      = ?,
          orderbuy      = ?,
          prodetail_id  = COALESCE(?, prodetail_id),
          company_id    = COALESCE(?, company_id),
          chem_price    = COALESCE(?, chem_price),
          coa           = COALESCE(?, coa),
          msds          = COALESCE(?, msds)
        WHERE pod_id = ?
      `;
      connection.query(
        sqlUpdate,
        [newUse, newBuy, prodetail_id ?? null, company_id ?? null, chem_price ?? null, coa ?? null, msds ?? null, row.pod_id],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          return res.status(200).json({ message: 'updated', pod_id: row.pod_id, orderuse: newUse, orderbuy: newBuy });
        }
      );
      return;
    }

    const sqlInsert = `
      INSERT INTO productorderdetail
        (prodetail_id, chem_id, proorder_id, company_id, orderuse, orderbuy, chem_price, coa, msds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    connection.query(
      sqlInsert,
      [
        prodetail_id ?? null,
        chem_id,
        proorder_id,
        company_id ?? null,
        useQty,
        buyQty,
        chem_price ?? null,
        coa ?? null,
        msds ?? null
      ],
      (err3, result) => {
        if (err3) return res.status(500).json({ error: err3.message });
        return res.status(201).json({ message: 'created', pod_id: result.insertId });
      }
    );
  });
});


// ---------- READ (JOIN + คอลัมน์เรียงลำดับตามที่ขอ) ----------
// รองรับ query:
//  - q= ค้นหา (chem_name, company_name, order_lot)
//  - proorder_id= กรองตามใบสั่งผลิต
//  - sort= ฟิลด์เรียง (chem_name|order_lot|company_name|orderuse|chem_price|orderbuy)
//  - order= asc|desc
router.get('/read', (req, res) => {
  const { q = '', proorder_id, sort, order } = req.query;

  // map ฟิลด์ที่อนุญาตให้ sort
  const SORT_MAP = {
    chem_name: 'c.chem_name',
    order_lot: 'po.order_lot',
    company_name: 'cp.company_name',
    orderuse: 'pod.orderuse',
    chem_price: 'pod.chem_price',
    orderbuy: 'pod.orderbuy'
  };
  const sortCol = SORT_MAP[sort] || 'pod.pod_id';
  const sortDir = (String(order || '').toLowerCase() === 'asc') ? 'ASC' : 'DESC';

  const params = [];
  const where = [];

  if (proorder_id) {
    where.push('pod.proorder_id = ?');
    params.push(Number(proorder_id));
  }
  if (q) {
    where.push('(c.chem_name LIKE ? OR cp.company_name LIKE ? OR po.order_lot LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  const sql = `
    SELECT
      pod.pod_id,
      c.chem_name,
      po.order_lot,
      cp.company_name,
      pod.orderuse,
      pod.chem_price,
      pod.orderbuy,
      pod.coa,
      pod.msds
    FROM productorderdetail pod
    LEFT JOIN chem c       ON c.chem_id = pod.chem_id
    LEFT JOIN productorder po ON po.proorder_id = pod.proorder_id
    LEFT JOIN company cp   ON cp.company_id = pod.company_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY ${sortCol} ${sortDir}, pod.pod_id DESC
  `;

  connection.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // คืนเป็น array ตรงๆ ให้ตาราง render ได้เลย
    res.json(Array.isArray(rows) ? rows : []);
  });
});


// ---------- READ BY ID (JOIN เช่นเดียวกัน) ----------
router.get('/read/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id is required' });

  const sql = `
    SELECT
      pod.pod_id,
      c.chem_name,
      po.order_lot,
      cp.company_name,
      pod.orderuse,
      pod.chem_price,
      pod.orderbuy,
      pod.coa,
      pod.msds,
      -- ส่ง id อ้างอิงเผื่อหน้าแก้ไข
      pod.chem_id,
      pod.proorder_id,
      pod.company_id
    FROM productorderdetail pod
    LEFT JOIN chem c       ON c.chem_id = pod.chem_id
    LEFT JOIN productorder po ON po.proorder_id = pod.proorder_id
    LEFT JOIN company cp   ON cp.company_id = pod.company_id
    WHERE pod.pod_id = ?
    LIMIT 1
  `;
  connection.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!rows || rows.length === 0) return res.status(404).json({ message: 'not found' });
    res.json(rows[0]);
  });
});


// ---------- READ BY ORDER (คงไว้ แต่ปรับคอลัมน์ให้ตรงที่ขอ) ----------
router.get('/by-order/:proorderId', (req, res) => {
  const proorderId = Number(req.params.proorderId);
  if (!proorderId) return res.status(400).json({ error: 'proorderId is required' });

  const sql = `
    SELECT
      pod.pod_id,
      c.chem_name,
      po.order_lot,
      cp.company_name,
      pod.orderuse,
      pod.chem_price,
      pod.orderbuy,
      pod.coa,
      pod.msds
    FROM productorderdetail pod
    LEFT JOIN chem c       ON c.chem_id = pod.chem_id
    LEFT JOIN productorder po ON po.proorder_id = pod.proorder_id
    LEFT JOIN company cp   ON cp.company_id = pod.company_id
    WHERE pod.proorder_id = ?
    ORDER BY pod.pod_id ASC
  `;
  connection.query(sql, [proorderId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(Array.isArray(rows) ? rows : []);
  });
});


// ---------- UPDATE (เหมือนเดิม) ----------
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


// ---------- DELETE (เหมือนเดิม) ----------
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

module.exports = router;
