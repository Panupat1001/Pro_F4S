const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const connection = require("../config/db");

/* ============================
 * 1) อัปโหลดรูปภาพสินค้า (คงเดิม)
 * ============================ */
const IMAGE_DIR = path.join(__dirname, "..", "public", "uploads", "products");
fs.mkdirSync(IMAGE_DIR, { recursive: true });

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGE_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const imageFilter = (req, file, cb) => {
  const ok = ["image/jpeg","image/png","image/webp","image/gif"].includes(file.mimetype);
  if (!ok) return cb(new Error("Invalid file type"));
  cb(null, true);
};
const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});
router.post("/product-image", uploadImage.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  const url = `/uploads/products/${req.file.filename}`;
  return res.json({ url });
});

/* ===============================================
 * 2) อัปโหลด COA/MSDS (PDF)  — ทาง B (นอก public)
 *    - เก็บจริงที่ ./uploads/productorderdetail/...
 *    - เสิร์ฟผ่าน /files/...
 *    - อัปโหลดใหม่ลบไฟล์เก่า
 * =============================================== */
const UPLOADS_ROOT = path.join(__dirname, "..", "uploads"); // นอก public
const PDF_ROOT = path.join(UPLOADS_ROOT, "productorderdetail");
fs.mkdirSync(PDF_ROOT, { recursive: true });

const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const podId = Number(req.body.pod_id);
    if (!podId) return cb(new Error("pod_id is required"), null);
    const dest = path.join(PDF_ROOT, `pod_${podId}`);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const field = file.fieldname; // 'coa' | 'msds'
    const ts = Date.now();
    const rnd = Math.random().toString(36).slice(2, 8);
    cb(null, `${field}_${ts}_${rnd}.pdf`);
  },
});
const pdfFilter = (req, file, cb) => {
  if (file.mimetype !== "application/pdf") return cb(new Error("รองรับเฉพาะไฟล์ PDF เท่านั้น"), false);
  cb(null, true);
};
const uploadPDF = multer({
  storage: pdfStorage,
  fileFilter: pdfFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});
const mkFilesUrl = (podId, file) =>
  file ? `/files/productorderdetail/pod_${podId}/${file.filename}` : null;

router.put(
  "/coa-msds",
  uploadPDF.fields([{ name: "coa", maxCount: 1 }, { name: "msds", maxCount: 1 }]),
  (req, res) => {
    const podId = Number(req.body.pod_id);
    if (!podId) return res.status(400).json({ error: "pod_id is required" });

    const coaFile  = req.files?.coa?.[0]  || null;
    const msdsFile = req.files?.msds?.[0] || null;
    if (!coaFile && !msdsFile) {
      return res.status(400).json({ error: "ต้องอัปโหลดอย่างน้อย 1 ไฟล์ (coa หรือ msds)" });
    }

    const sqlSelect = `SELECT coa, msds FROM productorderdetail WHERE pod_id = ? LIMIT 1`;
    connection.query(sqlSelect, [podId], (errSel, rows) => {
      if (errSel) {
        try { if (coaFile)  fs.unlinkSync(coaFile.path); } catch {}
        try { if (msdsFile) fs.unlinkSync(msdsFile.path); } catch {}
        return res.status(500).json({ error: errSel.message });
      }

      const oldCoa  = rows?.[0]?.coa  || null;
      const oldMsds = rows?.[0]?.msds || null;

      const sets = [];
      const params = [];
      if (coaFile)  { sets.push("coa = ?");  params.push(mkFilesUrl(podId, coaFile)); }
      if (msdsFile) { sets.push("msds = ?"); params.push(mkFilesUrl(podId, msdsFile)); }
      params.push(podId);

      const sqlUpdate = `
        UPDATE productorderdetail
        SET ${sets.join(", ")}
        WHERE pod_id = ?
        LIMIT 1
      `;
      connection.query(sqlUpdate, params, (errUpd, r) => {
        if (errUpd) {
          try { if (coaFile)  fs.unlinkSync(coaFile.path); } catch {}
          try { if (msdsFile) fs.unlinkSync(msdsFile.path); } catch {}
          return res.status(500).json({ error: errUpd.message });
        }

        // ลบไฟล์เก่าที่ถูกแทนที่ (แปลง /files/... -> ./uploads/...)
        try {
          if (coaFile && oldCoa && oldCoa.startsWith("/files/")) {
            const oldDiskPath = path.join(UPLOADS_ROOT, oldCoa.replace("/files/", ""));
            if (fs.existsSync(oldDiskPath)) fs.unlinkSync(oldDiskPath);
          }
          if (msdsFile && oldMsds && oldMsds.startsWith("/files/")) {
            const oldDiskPath = path.join(UPLOADS_ROOT, oldMsds.replace("/files/", ""));
            if (fs.existsSync(oldDiskPath)) fs.unlinkSync(oldDiskPath);
          }
        } catch (e) {
          console.warn("⚠️ ลบไฟล์เก่าไม่สำเร็จ:", e.message);
        }

        return res.json({
          message: "uploaded",
          pod_id: podId,
          coa:  coaFile  ? mkFilesUrl(podId, coaFile)  : oldCoa,
          msds: msdsFile ? mkFilesUrl(podId, msdsFile) : oldMsds,
          affected: r.affectedRows,
        });
      });
    });
  }
);

module.exports = router;
