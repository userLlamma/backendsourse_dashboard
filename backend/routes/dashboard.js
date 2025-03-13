// backend/routes/dashboard.js
const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const { authenticate } = require('../middleware/auth');

// 获取仪表板概要统计 (需要认证)
router.get('/stats', authenticate, async (req, res) => {
  try {
    const students = await Student.find();
    
    // 计算在线/离线状态
    const now = new Date();
    const onlineStudents = students.filter(student => {
      const lastReport = new Date(student.lastReportTime);
      const diffMinutes = (now - lastReport) / (1000 * 60);
      return diffMinutes <= 2;
    });
    
    // 计算测试通过率
    const testResults = students
      .filter(s => s.lastTestResults)
      .map(s => ({
        studentId: s.studentId,
        name: s.name,
        score: s.lastTestResults.score,
        passed: s.lastTestResults.totalPassed,
        total: s.lastTestResults.totalPassed + s.lastTestResults.totalFailed
      }));
    
    // 计算通过率统计
    const totalTests = testResults.reduce((sum, s) => sum + s.total, 0);
    const passedTests = testResults.reduce((sum, s) => sum + s.passed, 0);
    const avgScore = testResults.length ? 
      testResults.reduce((sum, s) => sum + s.score, 0) / testResults.length : 0;
    
    // 响应统计信息
    res.json({
      totalStudents: students.length,
      onlineStudents: onlineStudents.length,
      todoItems: students.reduce((sum, s) => sum + (s.todoCount || 0), 0),
      testStats: {
        avgScore: Math.round(avgScore * 10) / 10,
        passRate: totalTests ? (passedTests / totalTests) * 100 : 0,
        totalTests,
        passedTests
      },
      lastUpdate: new Date()
    });
  } catch (error) {
    console.error('获取仪表板统计失败:', error);
    res.status(500).json({ error: '获取仪表板统计失败' });
  }
});

// 获取学生排行榜 (需要认证)
router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const students = await Student.find()
      .select('studentId name todoCount lastTestResults lastReportTime')
      .sort({ 'lastTestResults.score': -1 });
    
    const now = new Date();
    const leaderboard = students
      .filter(student => student.lastTestResults)
      .map(student => {
        const lastReport = new Date(student.lastReportTime);
        const diffMinutes = (now - lastReport) / (1000 * 60);
        
        return {
          studentId: student.studentId,
          name: student.name,
          score: student.lastTestResults.score,
          passRate: student.lastTestResults.totalPassed / 
            (student.lastTestResults.totalPassed + student.lastTestResults.totalFailed) * 100,
          todoCount: student.todoCount || 0,
          status: diffMinutes <= 2 ? 'online' : 'offline',
          lastSeen: student.lastReportTime
        };
      });
    
    res.json(leaderboard);
  } catch (error) {
    console.error('获取排行榜失败:', error);
    res.status(500).json({ error: '获取排行榜失败' });
  }
});

module.exports = router;