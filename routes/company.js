const express = require('express');
const router = express.Router();
const connection = require('../config/db');

// ✅ CREATE: เพิ่ม company
router.post("/create", (req, res) => {
    const { company_name } = req.body;
    connection.query(
        "INSERT INTO company(company_name) VALUES (?)",
        [company_name],
        (err, result) => {
            if (err) {
                console.log("Insert company error:", err);
                return res.status(400).send();
            }
            return res.status(201).json({ message: "Company created successfully" });
        }
    );
});

// ✅ READ: ดูทั้งหมด
router.get("/read", (req, res) => {
    connection.query("SELECT * FROM company", (err, result) => {
        if (err) {
            console.log(err);
            return res.status(400).send();
        }
        res.status(200).json(result);
    });
});

// ✅ READ ONE: ตาม id
router.get("/read/:id", (req, res) => {
    const id = req.params.id;
    connection.query("SELECT * FROM company WHERE company_id = ?", [id], (err, result) => {
        if (err) return res.status(400).send();
        res.status(200).json(result);
    });
});

// ✅ UPDATE
router.patch("/update/:id", (req, res) => {
    const id = req.params.id;
    const { company_name } = req.body;
    connection.query(
        "UPDATE company SET company_name = ? WHERE company_id = ?",
        [company_name, id],
        (err, result) => {
            if (err) return res.status(400).send();
            res.status(200).json({ message: "Company updated successfully" });
        }
    );
});

// ✅ DELETE
router.delete("/delete/:id", (req, res) => {
    const id = req.params.id;
    connection.query("DELETE FROM company WHERE company_id = ?", [id], (err, result) => {
        if (err) return res.status(400).send();
        if (result.affectedRows === 0) return res.status(404).json({ message: "Company not found" });
        res.status(200).json({ message: "Company deleted successfully" });
    });
});

module.exports = router;
