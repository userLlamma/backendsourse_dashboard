// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// 安全配置
app.use(helmet({
  contentSecurityPolicy: false,  // 启用前端React访问
}));

// 中间件
app.use(cors());
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

// 静态文件服务 - 生产环境
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  });
}

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
