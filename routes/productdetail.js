// routes/productdetail.js
const express = require('express');
const router = express.Router();
const connection = require('../config/db');

// ---------- CREATE (แถวเดียว) ----------
router.post("/create", (req, res) => {
  const { product_id, chem_id, chem_percent, productdetail_status } = req.body;
  connection.query(
    "INSERT INTO productdetail (product_id, chem_id, chem_percent, productdetail_status) VALUES (?, ?, ?, ?)",
    [product_id, chem_id, chem_percent, productdetail_status ?? 1],
    (err, result) => {
      if (err) {
        console.log("Insert productdetail error:", err);
        return res.status(400).json({ error: err.message });
      }
      res.status(201).json({ message: "ProductDetail created successfully", id: result.insertId });
    }
  );
});

// ---------- READ ALL ----------
router.get("/read", (_req, res) => {
  connection.query("SELECT * FROM productdetail", (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.status(200).json(result);
  });
});

// ---------- READ BY ROW ID ----------
router.get("/read/:id", (req, res) => {
  const id = req.params.id;
  connection.query("SELECT * FROM productdetail WHERE prodetail_id = ?", [id], (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.status(200).json(result);
  });
});

// ---------- UPDATE (แถวเดียว) ----------
router.patch("/update/:id", (req, res) => {
  const id = req.params.id;
  const { product_id, chem_id, chem_percent, productdetail_status } = req.body;
  connection.query(
    `UPDATE productdetail SET 
        product_id = ?, chem_id = ?, chem_percent = ?, productdetail_status = ?
     WHERE prodetail_id = ?`,
    [product_id, chem_id, chem_percent, productdetail_status ?? 1, id],
    (err, result) => {
      if (err) return res.status(400).json({ error: err.message });
      res.status(200).json({ message: "ProductDetail updated successfully", affected: result.affectedRows });
    }
  );
});

// ---------- DELETE (แถวเดียว) ----------
router.delete("/delete/:id", (req, res) => {
  const id = req.params.id;
  connection.query("DELETE FROM productdetail WHERE prodetail_id = ?", [id], (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: "ProductDetail not found" });
    res.status(200).json({ message: "ProductDetail deleted successfully" });
  });
});


// ================== เพิ่มเติมสำหรับบันทึกทั้งชุด ==================

// GET /productdetail/by-product/:productId
// ดึงรายการสารของสินค้านี้ (join ชื่อสาร)
router.get("/by-product/:productId", (req, res) => {
  const productId = parseInt(req.params.productId, 10);
  if (!Number.isInteger(productId)) return res.status(400).json({ message: "Invalid productId" });

  const sql = `
    SELECT 
      pd.prodetail_id,
      pd.product_id,
      pd.chem_id,
      c.chem_name,
      c.inci_name,
      pd.chem_percent,
      pd.productdetail_status
    FROM productdetail pd
    LEFT JOIN chem c ON c.chem_id = pd.chem_id
    WHERE pd.product_id = ?
    ORDER BY c.chem_name ASC, pd.prodetail_id ASC
  `;
  connection.query(sql, [productId], (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(rows || []);
  });
});

// POST /productdetail/save-chems
// body: { product_id: number, chems: [{ chem_id: number, chem_percent: number }], productdetail_status?: number }
router.post("/save-chems", (req, res) => {
  const { product_id, chems, productdetail_status } = req.body || {};
  const statusValue = Number.isInteger(productdetail_status) ? productdetail_status : 1;

  if (!Number.isInteger(product_id)) {
    return res.status(400).json({ message: "Invalid product_id" });
  }
  if (!Array.isArray(chems) || chems.length === 0) {
    return res.status(400).json({ message: "Empty chems" });
  }
  for (const c of chems) {
    if (!Number.isInteger(c.chem_id) || isNaN(Number(c.chem_percent))) {
      return res.status(400).json({ message: "Invalid chem item" });
    }
  }

  connection.beginTransaction(err => {
    if (err) return res.status(500).json({ message: "Begin transaction failed" });

    // 1) ลบของเก่าของสินค้านี้
    const delSql = `DELETE FROM productdetail WHERE product_id = ?`;
    connection.query(delSql, [product_id], (errDel) => {
      if (errDel) {
        return connection.rollback(() => res.status(500).json({ message: "Delete old chems failed" }));
      }

      // 2) ใส่ของใหม่ทั้งหมด (bulk insert)
      const values = chems.map(c => [product_id, c.chem_id, Number(c.chem_percent), statusValue]);
      const insSql = `
        INSERT INTO productdetail (product_id, chem_id, chem_percent, productdetail_status)
        VALUES ?
      `;
      connection.query(insSql, [values], (errIns, insRes) => {
        if (errIns) {
          console.error("insert chems failed:", errIns);
          return connection.rollback(() => res.status(500).json({ message: "Insert chems failed" }));
        }

        // 3) commit
        connection.commit(errCommit => {
          if (errCommit) {
            return connection.rollback(() => res.status(500).json({ message: "Commit failed" }));
          }
          res.json({ success: true, affected: insRes.affectedRows || 0 });
        });
      });
    });
  });
});

module.exports = router;
