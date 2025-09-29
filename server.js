// server.js
const express = require('express');
const path = require('path');
const app = express();

// --- Middlewares ---
app.use(express.static(path.join(__dirname, 'public')));
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
const uploadRouter = require('./routes/upload');

// ---- Mount แบบ legacy และแบบ /api (ให้เข้าทั้งสอง path) ----
app.use('/user', userRoutes);
app.use('/api/user', userRoutes);

app.use('/brand', brandRoutes);
app.use('/api/brand', brandRoutes);

app.use('/chem', chemRoutes);
app.use('/api/chem', chemRoutes);

app.use('/company', companyRoutes);
app.use('/api/company', companyRoutes);

app.use('/product', productRoutes);
app.use('/api/product', productRoutes);

app.use('/productdetail', productDetailRoutes);
app.use('/api/productdetail', productDetailRoutes);

app.use('/productorder', productorderRoutes);
app.use('/api/productorder', productorderRoutes);

app.use('/productorderdetail', productOrderDetailRoutes);
app.use('/api/productorderdetail', productOrderDetailRoutes);

app.use('/upload', uploadRouter);
app.use('/api/upload', uploadRouter);

// root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login', 'login.html'));
});

// (อาจเพิ่ม 404 handler ภายหลัง ถ้าต้องการ)
app.listen(3000, () => console.log('Server is running on port 3000'));
