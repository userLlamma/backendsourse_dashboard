// backend/routes/studentAuth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const { authenticate } = require('../middleware/auth');

// Student login route
router.post('/login', async (req, res) => {
  try {
    const { studentId, password } = req.body;
    
    // Validate input
    if (!studentId || !password) {
      return res.status(400).json({ error: '请提供学号和密码' });
    }
    
    // Find student
    const student = await Student.findOne({ studentId });
    
    if (!student) {
      return res.status(401).json({ error: '学号或密码无效' });
    }
    
    // Verify the student has registered
    if (!student.registered) {
      return res.status(401).json({ error: '此账号尚未完成注册，请先运行reporter.js进行注册' });
    }
    
    // Check password
    const isMatch = await student.matchPassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ error: '学号或密码无效' });
    }
    
    // Create token
    const token = jwt.sign(
      { id: student._id, role: 'student', studentId: student.studentId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      user: {
        id: student._id,
        studentId: student.studentId,
        name: student.name,
        role: 'student'
      }
    });
  } catch (error) {
    console.error('学生登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// Get current student info
router.get('/me', authenticate, async (req, res) => {
  try {
    // Verify this is a student token
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: '无权访问' });
    }
    
    const student = await Student.findById(req.user.id).select('-password');
    
    if (!student) {
      return res.status(404).json({ error: '学生未找到' });
    }
    
    res.json({
      id: student._id,
      studentId: student.studentId,
      name: student.name,
      role: 'student'
    });
  } catch (error) {
    console.error('获取学生信息失败:', error);
    res.status(500).json({ error: '获取学生信息失败' });
  }
});

// Change student password (student can change their own password)
router.post('/change-password', authenticate, async (req, res) => {
  try {
    // Verify this is a student token
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: '无权访问' });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '请提供当前密码和新密码' });
    }
    
    const student = await Student.findById(req.user.id);
    
    // Verify current password
    const isMatch = await student.matchPassword(currentPassword);
    
    if (!isMatch) {
      return res.status(401).json({ error: '当前密码不正确' });
    }
    
    // Update password
    student.password = newPassword;
    await student.save();
    
    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({ error: '修改密码失败' });
  }
});

module.exports = router;