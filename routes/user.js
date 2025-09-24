const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const connection = require('../config/db');

// ✅ CREATE: เพิ่มผู้ใช้ใหม่ (hash password)
router.post("/create", async (req, res) => {
  try {
    const { email, password, phonenumber } = req.body;

    const hash = await bcrypt.hash(password, 10);
    connection.query(
      "INSERT INTO `user`(email, password, phonenumber) VALUES(?, ?, ?)",
      [email, hash, phonenumber],
      (err, result) => {
        if (err) {
          console.log("Insert error:", err);
          return res.status(400).send();
        }
        return res.status(201).json({ message: "New user successfully created" });
      }
    );
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ✅ UPDATE: เปลี่ยน password โดยอิงจาก email
router.patch("/update/:email", (req, res) => {
    const email = req.params.email;
    const { newpassword } = req.body;
    connection.query(
        "UPDATE user SET password = ? WHERE email = ?",
        [newpassword, email],
        (err, result) => {
            if (err) {
                console.log("Update error:", err);
                return res.status(400).send();
            }
            return res.status(200).json({ message: "User password updated successfully" });
        }
    );
});

router.post('/login', (req, res) => {
  let { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'email และ password ต้องไม่ว่าง' });

  email = String(email).trim();

  connection.query(
    "SELECT email, password FROM `user` WHERE email = ? LIMIT 1",
    [email],
    async (err, rows) => {
      if (err) {
        console.error('Login error:', err.code, err.sqlMessage);
        return res.status(500).json({ message: 'Database error', code: err.code });
      }
      if (rows.length === 0) {
        return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
      }

      const u = rows[0];
      const stored = u.password || '';
      let ok = false;

      if (/^\$2[aby]\$/.test(stored)) {
        // bcrypt hash
        try { ok = await bcrypt.compare(password, stored); } catch(e) { console.error(e); }
      } else {
        // plain text
        ok = (stored === password);
      }

      if (!ok) return res.status(401).json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });

      return res.json({ message: 'ok', user: { email: u.email } });
    }
  );
});

module.exports = router;