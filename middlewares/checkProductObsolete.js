// middlewares/checkProductObsolete.js
const connection = require('../config/db');

// คืนค่า: 'ยังไม่หมดอายุ' | 'ใกล้หมดอายุ' | 'หมดอายุ'
function calcStatusFromExp(expDateStr) {
  if (!expDateStr) return 'ยังไม่หมดอายุ';

  const today = new Date(); today.setHours(0,0,0,0);
  const exp = new Date(expDateStr);
  if (isNaN(exp.getTime())) return 'ยังไม่หมดอายุ';
  exp.setHours(0,0,0,0);

  if (exp < today) return 'หมดอายุ';

  const sixMonthsAhead = new Date(today);
  sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);
  if (exp <= sixMonthsAhead) return 'ใกล้หมดอายุ';

  return 'ยังไม่หมดอายุ';
}

function attachStatusFromBody(req, _res, next) {
  try {
    req.body.product_obsolete = calcStatusFromExp(req.body.product_exp);
    next();
  } catch (err) { next(err); }
}

module.exports = {
  calcStatusFromExp,
  attachStatusFromBody,
};
