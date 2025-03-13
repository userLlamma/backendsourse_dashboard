// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: '请提供用户名和密码' });
    }
    
    // 查找用户
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(401).json({ error: '用户名或密码无效' });
    }
    
    // 检查密码
    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ error: '用户名或密码无效' });
    }
    
    // 创建token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 验证当前用户 (需要认证)
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: '用户未找到' });
    }
    
    res.json({
      id: user._id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 创建新用户 (仅管理员)
router.post('/register', authenticate, async (req, res) => {
  try {
    // 验证当前用户是否为管理员
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { username, password, name, email, role } = req.body;
    
    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json({ error: '请提供用户名和密码' });
    }
    
    // 检查用户名是否已存在
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    
    // 创建新用户
    const user = new User({
      username,
      password,
      name,
      email,
      role: role || 'teacher'
    });
    
    await user.save();
    
    res.status(201).json({
      message: '用户创建成功',
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('创建用户失败:', error);
    res.status(500).json({ error: '创建用户失败' });
  }
});

module.exports = router;
