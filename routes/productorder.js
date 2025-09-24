const express = require('express');
const router = express.Router();
const connection = require('../config/db');

// CREATE
router.post('/create', (req, res) => {
  const {
    product_id,
    order_quantity,
    order_lot,
    order_date,
    order_exp,
    PH,
    color,
    smell,
    amount,
    price
  } = req.body;

  connection.query(
    `INSERT INTO productorder 
     (product_id, order_quantity, order_lot, order_date, order_exp, PH, color, smell, amount, price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [product_id, order_quantity, order_lot, order_date, order_exp, PH, color, smell, amount, price],
    (err, result) => {
      if (err) {
        console.log("Insert order error:", err);
        return res.status(400).json({ error: err.message });
      }
      res.status(201).json({ message: "Order created successfully" });
    }
  );
});

// READ ALL
router.get('/read', (req, res) => {
  connection.query("SELECT * FROM productorder", (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.status(200).json(result);
  });
});

// READ BY ID
router.get('/read/:id', (req, res) => {
  const id = req.params.id;
  connection.query("SELECT * FROM productorder WHERE productorder_id = ?", [id], (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.status(200).json(result);
  });
});

// UPDATE
router.patch('/update/:id', (req, res) => {
  const id = req.params.id;
  const {
    product_id,
    order_quantity,
    order_lot,
    order_date,
    order_exp,
    PH,
    color,
    smell,
    amount,
    price
  } = req.body;

  connection.query(
    `UPDATE productorder SET 
     product_id = ?, order_quantity = ?, order_lot = ?, order_date = ?, 
     order_exp = ?, PH = ?, color = ?, smell = ?, amount = ?, price = ?
     WHERE productorder_id = ?`,
    [product_id, order_quantity, order_lot, order_date, order_exp, PH, color, smell, amount, price, id],
    (err, result) => {
      if (err) return res.status(400).json({ error: err.message });
      res.status(200).json({ message: "Order updated successfully" });
    }
  );
});

// DELETE
router.delete('/delete/:id', (req, res) => {
  const id = req.params.id;
  connection.query("DELETE FROM productorder WHERE productorder_id = ?", [id], (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: "Order not found" });
    res.status(200).json({ message: "Order deleted successfully" });
  });
});

module.exports = router;
