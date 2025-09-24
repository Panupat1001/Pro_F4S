const express = require('express');
const router = express.Router();
const connection = require('../config/db');

// CREATE
router.post('/create', (req, res) => {
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
    `INSERT INTO productorderdetail
    (prodetail_id, chem_id, proorder_id, company_id, orderuse, orderbuy, chem_price, coa, msds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [prodetail_id, chem_id, proorder_id, company_id, orderuse, orderbuy, chem_price, coa, msds],
    (err, result) => {
      if (err) {
        console.log("Insert productorderdetail error:", err);
        return res.status(400).json({ error: err.message });
      }
      res.status(201).json({ message: "ProductOrderDetail created successfully" });
    }
  );
});

// READ ALL
router.get('/read', (req, res) => {
  connection.query("SELECT * FROM productorderdetail", (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.status(200).json(result);
  });
});

// READ BY ID
router.get('/read/:id', (req, res) => {
  const id = req.params.id;
  connection.query("SELECT * FROM productorderdetail WHERE pod_id = ?", [id], (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.status(200).json(result);
  });
});

// UPDATE
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
    (err, result) => {
      if (err) return res.status(400).json({ error: err.message });
      res.status(200).json({ message: "ProductOrderDetail updated successfully" });
    }
  );
});

// DELETE
router.delete('/delete/:id', (req, res) => {
  const id = req.params.id;
  connection.query("DELETE FROM productorderdetail WHERE pod_id = ?", [id], (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: "ProductOrderDetail not found" });
    res.status(200).json({ message: "ProductOrderDetail deleted successfully" });
  });
});

module.exports = router;
