// Modified createAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB 连接成功'))
  .catch(err => {
    console.log(process.env.MONGODB_URI);
    console.error('MongoDB 连接失败:', err);
    process.exit(1);
  });

const createAdmin = async () => {
  try {
    // Check if admin already exists
    const existingAdmin = await User.findOne({ username: 'admin' });
    
    if (existingAdmin) {
      console.log('管理员用户已存在');
      process.exit(0);
    }

    if (!process.env.ADMIN_PASSWORD) {
      console.error('错误: 需要设置 ADMIN_PASSWORD 环境变量');
      process.exit(1);
    }
    
    // Create new admin using env variables
    const admin = new User({
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD, // This will be hashed automatically
      name: process.env.ADMIN_NAME || '系统管理员',
      role: 'admin'
    });
    
    await admin.save();
    console.log('管理员用户创建成功');
    process.exit(0);
  } catch (error) {
    console.error('创建管理员失败:', error);
    process.exit(1);
  }
};

createAdmin();