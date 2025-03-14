// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// 安全配置 - 为开发环境禁用严格的CSP设置
app.use(helmet({
  contentSecurityPolicy: false,
}));

// CORS配置 - 允许所有来源以满足开发需求
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'x-student-id', 'x-api-key']
}));

// 中间件
app.use(express.json({ limit: '5mb' }));  // 增加限制以容纳更多数据
app.use(morgan('dev'));  // 日志


// 连接到MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB 连接成功'))
  .catch(err => {
    console.error('MongoDB 连接失败:', err);
    process.exit(1);
  });

// 导入路由
const studentRoutes = require('./routes/students');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');

// 使用路由
app.use('/api/students', studentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);



// 静态文件服务 - 生产环境和开发环境都使用相同配置
app.use(express.static(path.join(__dirname, '../frontend/build')));

// 所有未匹配的路由返回React应用
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器错误' });
});

// 启动服务器
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`服务器在端口 ${PORT} 上运行`);
});