// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
require('dotenv').config();

const app = express();

// 安全配置 - 为开发环境禁用严格的CSP设置
app.use(helmet({
  contentSecurityPolicy: false,
}));

// CORS配置
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token', 'x-student-id', 'x-api-key']
}));

// 日志配置
// 创建日志目录
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// 创建日志流
const accessLogStream = fs.createWriteStream(
  path.join(logDir, 'access.log'), 
  { flags: 'a' }
);

// 使用morgan进行日志记录
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev'));  // 开发环境控制台日志

// 中间件
app.use(express.json({ limit: '5mb' }));  // 增加限制以容纳更多数据

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
const studentAuthRoutes = require('./routes/studentAuth');
const studentManagementRoutes = require('./routes/studentManagement');

// 使用路由
app.use('/api/students', studentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/student-auth', studentAuthRoutes);
app.use('/api/student-management', studentManagementRoutes);

// 数据库备份路由 (仅管理员)
const { authenticate } = require('./middleware/auth');
app.get('/api/backup', authenticate, async (req, res) => {
  try {
    // 验证用户是否为管理员
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    // 导出数据 (简单示例，实际应用中可能更复杂)
    const Student = require('./models/Student');
    const User = require('./models/User');
    
    const students = await Student.find().select('-password');
    const users = await User.find().select('-password');
    
    const backup = {
      timestamp: new Date(),
      students,
      users
    };
    
    res.json(backup);
  } catch (error) {
    console.error('备份失败:', error);
    res.status(500).json({ error: '备份失败' });
  }
});

// 静态文件服务
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
  console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
});

// 定期数据库备份
if (process.env.ENABLE_AUTO_BACKUP === 'true') {
  const { createBackup } = require('./utils/backup');
  const BACKUP_INTERVAL = parseInt(process.env.BACKUP_INTERVAL || '86400000'); // 默认24小时
  
  console.log(`自动备份已启用，间隔: ${BACKUP_INTERVAL / (60 * 60 * 1000)} 小时`);
  setInterval(createBackup, BACKUP_INTERVAL);
  
  // 初次启动时执行备份
  setTimeout(createBackup, 10000);
}