require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

// 连接到MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB 连接成功'))
  .catch(err => {
    console.log(process.env.MONGODB_URI);
    console.error('MongoDB 连接失败:', err);
    process.exit(1);
  });

const createAdmin = async () => {
  try {
    // 检查是否已存在
    const existingAdmin = await User.findOne({ username: 'admin' });
    
    if (existingAdmin) {
      console.log('管理员用户已存在');
      process.exit(0);
    }
    
    // 创建新管理员
    const admin = new User({
      username: 'admin',
      password: 'your_secure_password', // 会自动哈希
      name: '系统管理员',
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