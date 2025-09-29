// routes/product.js
const express = require("express");
const router = express.Router();
const connection = require("../config/db");

// middlewares
const { attachStatusFromBody, calcStatusFromExp } = require("../middlewares/checkProductObsolete");

function updateProductHandler(req, res) {
  const id = req.params.id;
  let {
    brand_id,
    product_name,
    product_picture1,
    product_picture2,
    product_picture3,
    product_fdanum,
    product_exp,
    product_fdadate,
    product_obsolete,
  } = req.body ?? {};

  // alias -> ชื่อจริง (กันฟรอนต์เก่า)
  if (!product_fdanum && req.body?.notify_no)        product_fdanum  = req.body.notify_no;
  if (!product_fdadate && req.body?.notify_date)     product_fdadate = req.body.notify_date;
  if (!product_exp && req.body?.expire_date)         product_exp     = req.body.expire_date;

  const emptyToNull = (v) => (v === '' || v === undefined) ? null : v;

  const doUpdate = () => {
    const sql = `
      UPDATE product p
         SET p.brand_id         = COALESCE(?, p.brand_id),
             p.product_name     = COALESCE(?, p.product_name),
             p.product_picture1 = COALESCE(?, p.product_picture1),
             p.product_picture2 = COALESCE(?, p.product_picture2),
             p.product_picture3 = COALESCE(?, p.product_picture3),
             p.product_fdanum   = COALESCE(?, p.product_fdanum),
             p.product_exp      = COALESCE(?, p.product_exp),
             p.product_fdadate  = COALESCE(?, p.product_fdadate),
             p.product_obsolete = COALESCE(?, p.product_obsolete)
       WHERE p.product_id = ?
    `;
    connection.query(
      sql,
      [
        brand_id ?? null,
        emptyToNull(product_name),
        emptyToNull(product_picture1),
        emptyToNull(product_picture2),
        emptyToNull(product_picture3),
        emptyToNull(product_fdanum),
        emptyToNull(product_exp),
        emptyToNull(product_fdadate),
        product_obsolete ?? null,
        id,
      ],
      (err, result) => {
        if (err) {
          console.error('Update product error:', err);
          return res.status(500).json({ message: 'DB error', detail: err.sqlMessage });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'ไม่พบรายการที่ต้องการอัปเดต' });
        }
        res.json({
          success: true,
          affectedRows: result.affectedRows,
          message: result.affectedRows > 0 ? 'อัปเดตสำเร็จ' : 'ไม่มีการเปลี่ยนแปลงค่า',
        });
      }
    );
  };

  if (brand_id !== undefined && brand_id !== null && brand_id !== '') {
    connection.query(
      'SELECT 1 FROM brand WHERE brand_id = ? LIMIT 1',
      [brand_id],
      (err, rows) => {
        if (err) {
          console.error('Validate brand error:', err);
          return res.status(500).json({ message: 'DB error' });
        }
        if (!rows || rows.length === 0) {
          return res.status(400).json({ message: 'brand_id ไม่ถูกต้อง ไม่มีอยู่ในระบบ' });
        }
        doUpdate();
      }
    );
  } else {
    brand_id = null;
    doUpdate();
  }
}

// ใช้ร่วมกับทั้ง PUT และ PATCH
router.put('/:id',  attachStatusFromBody, updateProductHandler);
router.patch('/:id', attachStatusFromBody, updateProductHandler);
router.get("/options-ready-all", (_req, res) => {
  const sql = `
    SELECT
      p.product_id   AS id,
      p.product_name,
      p.product_fdanum,
      p.product_fdadate
    FROM product p
    WHERE EXISTS (
      SELECT 1
      FROM productdetail d
      WHERE d.product_id = p.product_id
        AND d.productdetail_status = 1
    )
    ORDER BY p.product_name ASC
  `;
  connection.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// CREATE — คำนวณสถานะจาก exp ก่อน insert
router.post("/create", attachStatusFromBody, (req, res) => {
  const {
    brand_id,
    product_name,
    product_picture1,
    product_picture2,
    product_picture3,
    product_fdanum,
    product_exp,
    product_fdadate,
  } = req.body;

  const sql = `
    INSERT INTO product (
      brand_id, product_name, product_picture1, product_picture2, product_picture3,
      product_fdanum, product_exp, product_fdadate, product_obsolete
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  connection.query(
    sql,
    [
      brand_id,
      product_name,
      product_picture1,
      product_picture2,
      product_picture3,
      product_fdanum,
      product_exp,
      product_fdadate,
      req.body.product_obsolete,
    ],
    (err, result) => {
      if (err) {
        console.error("Insert product error:", err);
        return res.status(500).json({ message: "DB error" });
      }
      res.json({ message: "เพิ่มผลิตภัณฑ์สำเร็จ", id: result.insertId });
    }
  );
});


// READ (search + pagination + sort + join brand)
router.get("/read", (req, res) => {
  const q = (req.query.q || "").trim();

  const pageSize = 7;
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const offset = (page - 1) * pageSize;

  const sortBy = String(req.query.sortBy || "product_name");
  const sortDirRaw = String(req.query.sortDir || "asc").toLowerCase();
  const sortDir = sortDirRaw === "desc" ? "DESC" : "ASC";

  const statusCase = `
    CASE
      WHEN p.product_exp < CURDATE() THEN 2
      WHEN p.product_exp <= DATE_ADD(CURDATE(), INTERVAL 6 MONTH) THEN 1
      ELSE 0
    END
  `;

  const sortMap = {
    product_name: "p.product_name",
    notify_no: "p.product_fdanum",
    notify_date: "p.product_fdadate",
    expire_date: "p.product_exp",
    brand_name: "b.brand_name",
    status: statusCase,
    created: "p.product_id",
  };

  const orderExpr = sortMap[sortBy] || sortMap.product_name;

  const whereClauses = [];
  const params = [];
  if (q) {
    whereClauses.push(`(
      p.product_name LIKE ? OR
      p.product_fdanum LIKE ? OR
      b.brand_name LIKE ?
    )`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(*) AS total
    FROM product p
    LEFT JOIN brand b ON b.brand_id = p.brand_id
    ${whereSql}
  `;

  const dataSql = `
    SELECT
      p.product_id AS id,
      p.product_name,
      p.product_picture1 AS product_image,
      p.product_fdanum    AS notify_no,
      DATE_FORMAT(p.product_fdadate, '%Y-%m-%d') AS notify_date,
      DATE_FORMAT(p.product_exp, '%Y-%m-%d')     AS expire_date,
      b.brand_name,
      ${statusCase} AS status
    FROM product p
    LEFT JOIN brand b ON b.brand_id = p.brand_id
    ${whereSql}
    ORDER BY ${orderExpr} ${sortDir}, p.product_id DESC
    LIMIT ? OFFSET ?
  `;

  connection.query(countSql, params, (err, countRows) => {
    if (err) {
      console.error("Count product error:", err);
      return res.status(500).json({ message: "DB error" });
    }
    const total = countRows[0]?.total || 0;
    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    connection.query(dataSql, [...params, pageSize, offset], (err2, rows) => {
      if (err2) {
        console.error("Read product error:", err2);
        return res.status(500).json({ message: "DB error" });
      }
      res.json({
        data: rows,
        totalPages,
        currentPage: page,
      });
    });
  });
});

// READ-ALL (ดึงทั้งหมด สำหรับ client-side sort/pagination)
router.get("/read-all", (req, res) => {
  const q = (req.query.q || "").trim();

  const statusCase = `
    CASE
      WHEN p.product_exp < CURDATE() THEN 2
      WHEN p.product_exp <= DATE_ADD(CURDATE(), INTERVAL 6 MONTH) THEN 1
      ELSE 0
    END
  `;

  const whereClauses = [];
  const params = [];
  if (q) {
    whereClauses.push(`(
      p.product_name LIKE ? OR
      p.product_fdanum LIKE ? OR
      b.brand_name LIKE ?
    )`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const sql = `
    SELECT
      p.product_id AS id,
      p.product_name,
      p.product_picture1 AS product_image,
      p.product_picture2,
      p.product_picture3,
      p.product_fdanum    AS notify_no,
      DATE_FORMAT(p.product_fdadate, '%Y-%m-%d') AS notify_date,
      DATE_FORMAT(p.product_exp, '%Y-%m-%d')     AS expire_date,
      b.brand_name,
      ${statusCase} AS status
    FROM product p
    LEFT JOIN brand b ON b.brand_id = p.brand_id
    ${whereSql}
    ORDER BY p.product_id DESC
  `;

  connection.query(sql, params, (err, rows) => {
    if (err) {
      console.error("Read-all product error:", err);
      return res.status(500).json({ message: "DB error" });
    }
    res.json(rows || []);
  });
});

// GET /product/:id — รายละเอียดผลิตภัณฑ์เดียว (ส่งชื่อจริง + alias เดิม)
router.get("/:id", (req, res) => {
  const id = req.params.id;

  const statusCase = `
    CASE
      WHEN p.product_exp < CURDATE() THEN 2
      WHEN p.product_exp <= DATE_ADD(CURDATE(), INTERVAL 6 MONTH) THEN 1
      ELSE 0
    END
  `;

  const sql = `
    SELECT
      p.product_id AS id,
      p.brand_id,                             -- ให้ฟรอนต์ bind ได้
      p.product_name,
      p.product_picture1,
      p.product_picture2,
      p.product_picture3,

      -- ชื่อจริง (ให้หน้า edit ใช้ส่งกลับ)
      p.product_fdanum,
      DATE_FORMAT(p.product_fdadate, '%Y-%m-%d') AS product_fdadate,
      DATE_FORMAT(p.product_exp, '%Y-%m-%d')     AS product_exp,

      -- alias เดิม (กันโค้ดเก่าพัง)
      p.product_fdanum    AS notify_no,
      DATE_FORMAT(p.product_fdadate, '%Y-%m-%d') AS notify_date,
      DATE_FORMAT(p.product_exp, '%Y-%m-%d')     AS expire_date,

      b.brand_name,
      ${statusCase} AS status
    FROM product p
    LEFT JOIN brand b ON b.brand_id = p.brand_id
    WHERE p.product_id = ?
    LIMIT 1
  `;

  connection.query(sql, [id], (err, rows) => {
    if (err) {
      console.error("Read product by id error:", err);
      return res.status(500).json({ message: "DB error" });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบข้อมูล" });
    }
    res.json(rows[0]);
  });
});

// PUT /:id — (คงไว้ได้) full/partial update เดิมของคุณ
router.put('/:id', attachStatusFromBody, async (req, res) => {
  const id = req.params.id;
  let {
    brand_id,
    product_name,
    product_picture1,
    product_picture2,
    product_picture3,
    product_fdanum,
    product_exp,
    product_fdadate,
    product_obsolete,
  } = req.body ?? {};

  // Map alias -> ชื่อจริง (กันฟรอนต์เก่า)
  if (!product_fdanum && req.body.notify_no)        product_fdanum  = req.body.notify_no;
  if (!product_fdadate && req.body.notify_date)     product_fdadate = req.body.notify_date;
  if (!product_exp && req.body.expire_date)         product_exp     = req.body.expire_date;

  if (brand_id !== undefined && brand_id !== null && brand_id !== '') {
    connection.query(
      'SELECT 1 FROM brand WHERE brand_id = ? LIMIT 1',
      [brand_id],
      (err, rows) => {
        if (err) {
          console.error('Validate brand error:', err);
          return res.status(500).json({ message: 'DB error' });
        }
        if (!rows || rows.length === 0) {
          return res.status(400).json({ message: 'brand_id ไม่ถูกต้อง ไม่มีอยู่ในระบบ' });
        }
        doUpdate();
      }
    );
  } else {
    brand_id = null;
    doUpdate();
  }

  function doUpdate() {
    const sql = `
      UPDATE product p
      SET
        p.brand_id         = COALESCE(?, p.brand_id),
        p.product_name     = COALESCE(?, p.product_name),
        p.product_picture1 = COALESCE(?, p.product_picture1),
        p.product_picture2 = COALESCE(?, p.product_picture2),
        p.product_picture3 = COALESCE(?, p.product_picture3),
        p.product_fdanum   = COALESCE(?, p.product_fdanum),
        p.product_exp      = COALESCE(?, p.product_exp),
        p.product_fdadate  = COALESCE(?, p.product_fdadate),
        p.product_obsolete = COALESCE(?, p.product_obsolete)
      WHERE p.product_id = ?
    `;

    connection.query(
      sql,
      [
        brand_id ?? null,
        emptyToNull(product_name),
        emptyToNull(product_picture1),
        emptyToNull(product_picture2),
        emptyToNull(product_picture3),
        emptyToNull(product_fdanum),
        emptyToNull(product_exp),
        emptyToNull(product_fdadate),
        product_obsolete ?? null,
        id,
      ],
      (err, result) => {
        if (err) {
          console.error('Update product error:', err);
          return res.status(500).json({ message: 'DB error', detail: err.sqlMessage });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'ไม่พบรายการที่ต้องการอัปเดต' });
        }
        res.json({
          success: true,
          affectedRows: result.affectedRows,
          message: result.affectedRows > 0 ? 'อัปเดตสำเร็จ' : 'ไม่มีการเปลี่ยนแปลงค่า',
        });
      }
    );
  }

  function emptyToNull(v) {
    return (v === '' || v === undefined) ? null : v;
  }
});




module.exports = router;
