// routes/chem.js
const express = require('express');
const router = express.Router();
const connection = require('../config/db');

// ✅ CREATE: เพิ่ม chem
router.post("/create", (req, res) => {
    const { chem_name, inci_name, chem_unit, chem_type, chem_quantity, chem_reorder, price_gram, chem_note } = req.body;
    connection.query(
        "INSERT INTO chem(chem_name, inci_name, chem_unit, chem_type, chem_quantity, chem_reorder, price_gram, chem_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [chem_name, inci_name, chem_unit, chem_type, chem_quantity, chem_reorder, price_gram, chem_note],
        (err, result) => {
            if (err) {
                console.error("Insert chem error:", err);
                return res.status(400).send();
            }
            return res.status(201).json({ message: "Chem created successfully" });
        }
    );
});

// routes/chem.js
router.get('/read', (req, res) => {
  const { q = '', id } = req.query;
  let sql = 'SELECT * FROM chem';
  const params = [];

  if (id) {
    sql += ' WHERE chem_id = ?';
    params.push(id);
  } else if (q) {
    const like = `%${q}%`;
    sql += ' WHERE chem_name LIKE ? OR inci_name LIKE ? OR chem_type LIKE ? OR CAST(chem_quantity AS CHAR) LIKE ?';
    params.push(like, like, like, like);
  }

  connection.query(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ message: 'db error', error: err });
    res.json(rows);
  });
});



// ✅ READ ONE: จาก ID
router.get("/read/:id", (req, res) => {
    const id = req.params.id;
    connection.query("SELECT * FROM chem WHERE chem_id = ?", [id], (err, result) => {
        if (err) return res.status(400).send();
        res.status(200).json(result);
    });
});

// ✅ UPDATE
router.patch("/update/:id", (req, res) => {
    const id = req.params.id;
    const { chem_name, inci_name, chem_unit, chem_type, chem_quantity, chem_reorder, price_gram, chem_note } = req.body;
    connection.query(
        "UPDATE chem SET chem_name = ?, inci_name = ?, chem_unit = ?, chem_type = ?, chem_quantity = ?, chem_reorder = ?, price_gram = ?, chem_note = ? WHERE chem_id = ?",
        [chem_name, inci_name, chem_unit, chem_type, chem_quantity, chem_reorder, price_gram, chem_note, id],
        (err, result) => {
            if (err) return res.status(400).send();
            res.status(200).json({ message: "Chem updated successfully" });
        }
    );
});

// ✅ DELETE
router.delete("/delete/:id", (req, res) => {
    const id = req.params.id;
    connection.query("DELETE FROM chem WHERE chem_id = ?", [id], (err, result) => {
        if (err) return res.status(400).send();
        if (result.affectedRows === 0) return res.status(404).json({ message: "Chem not found" });
        res.status(200).json({ message: "Chem deleted successfully" });
    });
});

// GET /chem/detail?id=123
router.get('/detail', (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ message: 'Missing id' });
  connection.query('SELECT * FROM chem WHERE chem_id = ?', [id], (err, rows) => {
    if (err) return res.status(500).json({ message: 'Database error' });
    if (!rows || rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  });
});

router.get('/read-all', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 1000, 5000);
  const sql = `
    SELECT
      chem_id      AS id,
      chem_name,
      inci_name,
      chem_unit,
      chem_type
    FROM chem
    ORDER BY chem_name ASC
    LIMIT ?
  `;
  connection.query(sql, [limit], (err, rows) => {
    if (err) {
      console.error('read-all chem error:', err);
      return res.status(500).json({ message: 'read chem failed' });
    }
    res.json(rows || []);
  });
});

// GET /chem/search?q=คำค้น&limit=50
router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

  if (!q) return res.json([]); // ไม่มีคำค้น → คืนลิสต์ว่าง

  const like = `%${q}%`;
  const sql = `
    SELECT
      chem_id   AS id,
      chem_name,
      inci_name,
      chem_unit,
      chem_type
    FROM chem
    WHERE chem_name LIKE ? OR inci_name LIKE ? OR chem_type LIKE ?
    ORDER BY chem_name ASC
    LIMIT ?
  `;
  connection.query(sql, [like, like, like, limit], (err, rows) => {
    if (err) {
      console.error('search chem error:', err);
      return res.status(500).json({ message: 'search chem failed' });
    }
    res.json(rows || []);
  });
});

router.patch('/:id/price-gram', (req, res) => {
  const id = Number(req.params.id);
  const priceGram = Number(req.body?.price_gram);

  if (!id || !Number.isFinite(priceGram) || priceGram <= 0) {
    return res.status(400).json({ error: 'ต้องระบุ id และ price_gram (> 0)' });
  }

  const sql = 'UPDATE chem SET price_gram = ? WHERE chem_id = ?';
  connection.query(sql, [priceGram, id], (err, result) => {
    if (err) {
      console.error('[chem price-gram] UPDATE error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'ไม่พบ chem ที่ระบุ' });
    }
    return res.json({ message: 'updated', chem_id: id, price_gram: priceGram });
  });
});

// ตัดสต็อกเคมี: chem_quantity = GREATEST(chem_quantity - orderuse, 0)
router.post('/decrease-quantity', (req, res) => {
  const { chem_id, orderuse } = req.body || {};
  const chemId = Number(chem_id);
  const useQty = Number(orderuse);

  if (!Number.isFinite(chemId) || chemId <= 0) {
    return res.status(400).json({ error: 'chem_id is required' });
  }
  if (!Number.isFinite(useQty) || useQty <= 0) {
    return res.status(400).json({ error: 'orderuse must be > 0' });
  }

  const sql = `
    UPDATE chem
    SET chem_quantity = GREATEST(chem_quantity - ?, 0)
    WHERE chem_id = ?
  `;
  connection.query(sql, [useQty, chemId], (err, result) => {
    if (err) {
      console.error('[chem decrease] update error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    // ดึงค่าใหม่กลับไปให้หน้า UI อัปเดตได้
    connection.query('SELECT chem_quantity FROM chem WHERE chem_id = ? LIMIT 1', [chemId], (err2, rows) => {
      if (err2) {
        console.error('[chem decrease] select error:', err2.message);
        return res.status(500).json({ error: err2.message });
      }
      const newQty = rows?.[0]?.chem_quantity ?? null;
      return res.json({ success: true, chem_id: chemId, chem_quantity: newQty });
    });
  });
});

router.put('/produce/:proorder_id', (req, res) => {
  const proorderId = Number(req.params.proorder_id);
  if (!proorderId) return res.status(400).json({ error: 'proorder_id is required' });

  connection.beginTransaction((err) => {
    if (err) return res.status(500).json({ error: err.message });

    // รวมราคา = ผลรวม(orderuse * price_gram) ของออเดอร์นี้
    const sqlSum = `
      SELECT SUM(pod.orderuse * c.price_gram) AS total_price
      FROM productorderdetail pod
      JOIN chem c ON c.chem_id = pod.chem_id
      WHERE pod.proorder_id = ?
    `;
    connection.query(sqlSum, [proorderId], (e1, rows1) => {
      if (e1) return connection.rollback(() => res.status(500).json({ error: e1.message }));

      const total = Number(rows1?.[0]?.total_price || 0);

      const sqlUpd = `
        UPDATE productorder
        SET price = ?, status = 1
        WHERE proorder_id = ?
      `;
      connection.query(sqlUpd, [total, proorderId], (e2) => {
        if (e2) return connection.rollback(() => res.status(500).json({ error: e2.message }));
        connection.commit((e3) => {
          if (e3) return connection.rollback(() => res.status(500).json({ error: e3.message }));
          res.json({ message: 'produce updated', total_price: total });
        });
      });
    });
  });
});
module.exports = router;
