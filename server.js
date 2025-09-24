// server.js
const express = require('express');
const path = require('path');
const app = express();

// --- Middlewares (ลำดับสำคัญ) ---
app.use(express.static(path.join(__dirname, 'public')));   // เสิร์ฟไฟล์ /public
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- Routes ---
const userRoutes = require('./routes/user');
const brandRoutes = require('./routes/brand');
const chemRoutes = require('./routes/chem');
const companyRoutes = require('./routes/company');
const productRoutes = require('./routes/product');
const productDetailRoutes = require('./routes/productdetail');
const productorderRoutes = require('./routes/productorder');
const productOrderDetailRoutes = require('./routes/productorderdetail');
const uploadRouter = require('./routes/upload');            // ✅ เพิ่ม

// mount ให้ชัด ไม่ซ้ำซ้อน
app.use('/api/user', userRoutes);
app.use('/brand', brandRoutes);
app.use('/api/brand', brandRoutes);                        // ถ้าต้องการให้เข้าทั้งสอง path
app.use('/chem', chemRoutes);
app.use('/api/chem', chemRoutes);                          // เช่นเดียวกัน
app.use('/company', companyRoutes);
app.use('/product', productRoutes);
app.use('/productdetail', productDetailRoutes);
app.use('/productorder', productorderRoutes);
app.use('/productorderdetail', productOrderDetailRoutes);
app.use('/upload', uploadRouter);                          // ✅ เส้นอัพโหลด (ทำให้ POST /upload/product-image ใช้งานได้)

// root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login', 'login.html'));
});

app.listen(3000, () => console.log('Server is running on port 3000'));
