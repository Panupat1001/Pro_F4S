// routes/upload.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// โฟลเดอร์เก็บไฟล์ใน public (ให้เสิร์ฟได้เป็นไฟล์ static)
const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "products");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random()*1e9)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ok = ["image/jpeg","image/png","image/webp","image/gif"].includes(file.mimetype);
  if (!ok) return cb(new Error("Invalid file type"));
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// ==> POST /upload/product-image
router.post("/product-image", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  const url = `/uploads/products/${req.file.filename}`; // เสิร์ฟจาก public/*
  return res.json({ url });
});

module.exports = router;
