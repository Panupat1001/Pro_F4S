// middlewares/checkProductObsolete.js
const connection = require('../config/db');

/**
 * แปลงค่าที่ได้จาก DB/Body ให้เป็น Local Date ชนิด "วันล้วน"
 * รองรับทั้ง:
 *  - String 'YYYY-MM-DD'
 *  - Date object (ที่ mysql driver คืนมา)
 */
function toLocalDateOnly(input) {
  if (!input) return null;

  // กรณี DB คืนเป็น Date object
  if (input instanceof Date) {
    const d = new Date(input.getFullYear(), input.getMonth(), input.getDate());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // กรณีเป็น string: ตัดให้เหลือ 'YYYY-MM-DD' แล้ว parse เป็น Local Date
  const s = String(input).slice(0, 10); // กันเคส 'YYYY-MM-DDTHH:mm:ss'
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;

  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/**
 * คืนค่า: 'ยังไม่หมดอายุ' | 'ใกล้หมดอายุ' | 'หมดอายุ'
 * ใช้ Local Date เทียบกันเพื่อเลี่ยงปัญหา UTC shift
 */
function calcStatusFromExp(expDate) {
  const exp = toLocalDateOnly(expDate);
  if (!exp) return 'ยังไม่หมดอายุ';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (exp < today) return 'หมดอายุ';

  const sixMonthsAhead = new Date(today);
  sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);

  if (exp <= sixMonthsAhead) return 'ใกล้หมดอายุ';
  return 'ยังไม่หมดอายุ';
}

// เมื่อ create/update: คำนวณจาก req.body.product_exp แล้วแนบกลับไปใน req.body
// เมื่อ create/update: คำนวณจากวันที่หมดอายุใน body แล้วแนบกลับไปใน req.body
function attachStatusFromBody(req, _res, next) {
  try {
    // กัน null/undefined
    const body = req.body ?? {};

    // รองรับหลายชื่อที่ฝั่งหน้าอาจส่งมา
    const exp =
      body.product_exp ??
      body.expire_date ??
      body.exp ??
      null;

    body.product_obsolete = calcStatusFromExp(exp);

    // เผื่อกรณี req.body เป็น undefined
    req.body = body;
    next();
  } catch (err) {
    next(err);
  }
}


// สำหรับ path :id -> ดึง exp จาก DB แล้วคำนวณ status เก็บใน res.locals.productStatus
function attachStatusById(req, res, next) {
  connection.query(
    'SELECT product_exp FROM product WHERE product_id = ?',
    [req.params.id],
    (err, rows) => {
      if (err) return next(err);
      if (!rows || rows.length === 0) {
        res.locals.productStatus = null;
        return next();
      }
      // rows[0].product_exp อาจเป็น Date หรือ String -> calcStatusFromExp รองรับแล้ว
      res.locals.productStatus = calcStatusFromExp(rows[0].product_exp);
      next();
    }
  );
}

// บล็อก action ถ้าสินค้าหมดอายุ
function requireNotExpired(_req, res, next) {
  if (res.locals.productStatus === 'หมดอายุ') {
    return res.status(400).json({ message: 'สินค้านี้หมดอายุแล้ว ทำรายการไม่ได้' });
  }
  next();
}

module.exports = { attachStatusFromBody, attachStatusById, requireNotExpired };
