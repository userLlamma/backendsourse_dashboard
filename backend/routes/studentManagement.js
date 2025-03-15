// backend/routes/studentManagement.js
const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const { authenticate } = require('../middleware/auth');

// Create a new student (teacher only)
router.post('/create', authenticate, async (req, res) => {
  try {
    // Verify user is teacher or admin
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { studentId, name, initialPassword } = req.body;
    
    // Validate required fields
    if (!studentId || !name) {
      return res.status(400).json({ error: '学号和姓名为必填项' });
    }
    
    // Check if student ID already exists
    const existingStudent = await Student.findOne({ studentId });
    if (existingStudent) {
      return res.status(400).json({ error: '此学号已存在' });
    }
    
    // Create new student
    const student = new Student({
      studentId,
      name,
      password: initialPassword || studentId, // Default to student ID if no password provided
      ipAddress: '0.0.0.0', // Will be updated when the student reports
      status: 'unknown'
    });
    
    await student.save();
    
    res.status(201).json({
      message: '学生创建成功',
      student: {
        id: student._id,
        studentId: student.studentId,
        name: student.name
      }
    });
  } catch (error) {
    console.error('创建学生失败:', error);
    res.status(500).json({ error: '创建学生失败' });
  }
});

// Reset student password (teacher only)
router.post('/:studentId/reset-password', authenticate, async (req, res) => {
  try {
    // Verify user is teacher or admin
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { studentId } = req.params;
    const { newPassword } = req.body;
    
    // Find student
    const student = await Student.findOne({ studentId });
    
    if (!student) {
      return res.status(404).json({ error: '学生未找到' });
    }
    
    // Reset password (default to student ID if no new password provided)
    student.password = newPassword || studentId;
    await student.save();
    
    res.json({ message: `学生 ${studentId} 的密码已重置` });
  } catch (error) {
    console.error('重置密码失败:', error);
    res.status(500).json({ error: '重置密码失败' });
  }
});

// Delete student (admin only)
router.delete('/:studentId', authenticate, async (req, res) => {
  try {
    // Verify user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { studentId } = req.params;
    
    // Find and delete student
    const student = await Student.findOneAndDelete({ studentId });
    
    if (!student) {
      return res.status(404).json({ error: '学生未找到' });
    }
    
    res.json({ message: `学生 ${studentId} 已删除` });
  } catch (error) {
    console.error('删除学生失败:', error);
    res.status(500).json({ error: '删除学生失败' });
  }
});

// Batch create students (admin only)
router.post('/batch', authenticate, async (req, res) => {
  try {
    // Verify user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { students } = req.body;
    
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: '请提供有效的学生数据数组' });
    }
    
    const results = {
      success: [],
      failed: []
    };
    
    // Process each student in the batch
    for (const studentData of students) {
      try {
        const { studentId, name } = studentData;
        
        if (!studentId || !name) {
          results.failed.push({ studentId, reason: '学号或姓名缺失' });
          continue;
        }
        
        // Check if student already exists
        const existingStudent = await Student.findOne({ studentId });
        if (existingStudent) {
          results.failed.push({ studentId, reason: '学号已存在' });
          continue;
        }
        
        // Create new student
        const student = new Student({
          studentId,
          name,
          password: studentId, // Default password is the student ID
          ipAddress: '0.0.0.0', // Will be updated when the student reports
          status: 'unknown'
        });
        
        await student.save();
        results.success.push({ studentId, name });
      } catch (err) {
        results.failed.push({ 
          studentId: studentData.studentId || 'unknown', 
          reason: '创建失败: ' + err.message 
        });
      }
    }
    
    res.json({
      message: `成功创建 ${results.success.length} 名学生，失败 ${results.failed.length} 名`,
      results
    });
  } catch (error) {
    console.error('批量创建学生失败:', error);
    res.status(500).json({ error: '批量创建学生失败' });
  }
});

// 重置学生密钥 (仅教师/管理员)
router.post('/:studentId/reset-keys', authenticate, async (req, res) => {
  try {
    // 验证用户是否有权限
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { studentId } = req.params;
    
    // 找到该学生
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: '学生不存在' });
    }
    
    // 1. 吊销所有现有密钥
    const keyPairs = await KeyPair.find({ studentId });
    for (const keyPair of keyPairs) {
      keyPair.revoked = {
        isRevoked: true,
        revokedAt: new Date(),
        revokedBy: req.user.id,
        reason: '教师重置'
      };
      await keyPair.save();
    }
    
    // 2. 重置学生的验证状态
    student.verificationStatus = {
      isVerified: false,
      verificationHistory: [
        ...student.verificationStatus?.verificationHistory || [],
        {
          timestamp: new Date(),
          success: false,
          notes: `由教师 ${req.user.username || req.user.id} 重置密钥`
        }
      ]
    };
    
    // 3. 清除挑战码
    student.authChallenge = null;
    
    // 4. 将学生标记为"需要重新验证"
    student.needsReauthentication = true;
    
    await student.save();
    
    res.json({ 
      success: true, 
      message: `已成功重置学生 ${studentId} 的密钥验证状态`,
      keysRevoked: keyPairs.length
    });
    
  } catch (error) {
    console.error('重置学生密钥失败:', error);
    res.status(500).json({ error: '重置学生密钥失败' });
  }
});

module.exports = router;