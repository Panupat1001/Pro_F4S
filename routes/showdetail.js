// routes/showdetail.js
const express = require('express');
const router = express.Router();
const connection = require('../config/db');

// ตาราง/คอลัมน์ตามสคีมาจริง
const TABLE_PO = 'productorder';   // ตารางจริง
const COL_ID   = 'proorder_id';    // PK
const COL_BATCH= 'order_lot';      // รหัสการผลิต

const TABLE_PRODUCT = 'product';
const TABLE_BRAND   = 'brand';

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

  // map field UI -> column จริง
  const sortMap = {
    id:           `po.${COL_ID}`,
    product_name: 'p.product_name',
    brand_name:   'b.brand_name',
    batch_code:   `po.${COL_BATCH}`,
  };
  const sf = sortMap[sortField] || `po.${COL_ID}`;
  const so = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const baseSelect = `
    SELECT
      po.${COL_ID} AS id,
      p.product_name AS product_name,
      COALESCE(p.product_picture1, p.product_picture2, p.product_picture3, '') AS product_image,
      po.${COL_BATCH} AS batch_code,
      b.brand_name AS brand_name
    FROM ${TABLE_PO} po
    LEFT JOIN ${TABLE_PRODUCT} p ON p.product_id = po.product_id
    LEFT JOIN ${TABLE_BRAND}   b ON b.brand_id   = p.brand_id
  `;

  // เหลือค้นหา 3 ฟิลด์เท่านั้น
  const whereSql = hasQ
    ? `WHERE (p.product_name LIKE ?) OR (b.brand_name LIKE ?) OR (po.${COL_BATCH} LIKE ?)`
    : '';

  const orderSql = `ORDER BY ${sf} ${so}, po.${COL_ID} DESC`;
  const limitSql = `LIMIT ? OFFSET ?`;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM ${TABLE_PO} po
    LEFT JOIN ${TABLE_PRODUCT} p ON p.product_id = po.product_id
    LEFT JOIN ${TABLE_BRAND}   b ON b.brand_id   = p.brand_id
    ${whereSql}
  `;

  const paramsCount = [];
  const paramsData  = [];
  if (hasQ) {
    // 3 placeholders ตาม whereSql
    paramsCount.push(qLike, qLike, qLike);
    paramsData .push(qLike, qLike, qLike);
  }
  paramsData.push(sizeNum, (pageNum - 1) * sizeNum);

  connection.query(countSql, paramsCount, (e1, r1) => {
    if (e1) {
      console.error('[GET /showdetail/list] count error:', e1);
      return res.status(500).json({ message: 'database error (count)', detail: e1.message });
    }
    const total = r1?.[0]?.total ?? 0;

    const dataSql = `${baseSelect} ${whereSql} ${orderSql} ${limitSql}`;
    connection.query(dataSql, paramsData, (e2, rows) => {
      if (e2) {
        console.error('[GET /showdetail/list] data error:', e2);
        return res.status(500).json({ message: 'database error (data)', detail: e2.message });
      }
      const items = (rows || []).map(r => ({
        id: r.id,
        product_name: r.product_name ?? '-',
        product_image: r.product_image ? String(r.product_image) : '',
        batch_code: r.batch_code ?? '-',
        brand_name: r.brand_name ?? '-',
      }));
      res.json({ items, total, page: pageNum, pageSize: sizeNum });
    });
  });
});

// (optional) รายการเดียว
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'invalid id' });

  const sql = `
    SELECT
      po.${COL_ID} AS id,
      p.product_name AS product_name,
      COALESCE(p.product_picture1, p.product_picture2, p.product_picture3, '') AS product_image,
      po.${COL_BATCH} AS batch_code,
      b.brand_name AS brand_name
    FROM ${TABLE_PO} po
    LEFT JOIN ${TABLE_PRODUCT} p ON p.product_id = po.product_id
    LEFT JOIN ${TABLE_BRAND}   b ON b.brand_id   = p.brand_id
    WHERE po.${COL_ID} = ?
    LIMIT 1
  `;
  connection.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'database error', detail: err.message });
    if (!rows || rows.length === 0) return res.status(404).json({ message: 'not found' });
    const r = rows[0];
    res.json({
      id: r.id,
      product_name: r.product_name ?? '-',
      product_image: r.product_image ? String(r.product_image) : '',
      batch_code: r.batch_code ?? '-',
      brand_name: r.brand_name ?? '-',
    });
  });
});

module.exports = router;
