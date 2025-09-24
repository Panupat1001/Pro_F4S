const express = require('express');
const router = express.Router();
const connection = require('../config/db');

// CREATE
router.post("/create", (req, res) => {
    const { product_id, chem_id, chem_percent, productdetail_status } = req.body;
    connection.query(
        "INSERT INTO productdetail (product_id, chem_id, chem_percent, productdetail_status) VALUES (?, ?, ?, ?)",
        [product_id, chem_id, chem_percent, productdetail_status],
        (err, result) => {
            if (err) {
                console.log("Insert productdetail error:", err);
                return res.status(400).json({ error: err.message });
            }
            res.status(201).json({ message: "ProductDetail created successfully" });
        }
    );
});

// READ ALL
router.get("/read", (req, res) => {
    connection.query("SELECT * FROM productdetail", (err, result) => {
        if (err) return res.status(400).json({ error: err.message });
        res.status(200).json(result);
    });
});

// READ BY ID
router.get("/read/:id", (req, res) => {
    const id = req.params.id;
    connection.query("SELECT * FROM productdetail WHERE prodetail_id = ?", [id], (err, result) => {
        if (err) return res.status(400).json({ error: err.message });
        res.status(200).json(result);
    });
});

// UPDATE
router.patch("/update/:id", (req, res) => {
    const id = req.params.id;
    const { product_id, chem_id, chem_percent, productdetail_status } = req.body;
    connection.query(
        `UPDATE productdetail SET 
            product_id = ?, chem_id = ?, chem_percent = ?, productdetail_status = ?
         WHERE prodetail_id = ?`,
        [product_id, chem_id, chem_percent, productdetail_status, id],
        (err, result) => {
            if (err) return res.status(400).json({ error: err.message });
            res.status(200).json({ message: "ProductDetail updated successfully" });
        }
    );
});

// DELETE
router.delete("/delete/:id", (req, res) => {
    const id = req.params.id;
    connection.query("DELETE FROM productdetail WHERE prodetail_id = ?", [id], (err, result) => {
        if (err) return res.status(400).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ message: "ProductDetail not found" });
        res.status(200).json({ message: "ProductDetail deleted successfully" });
    });
});

module.exports = router;
