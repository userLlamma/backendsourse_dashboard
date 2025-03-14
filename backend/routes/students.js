// backend/routes/students.js
const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const { authenticate } = require('../middleware/auth');

// 获取所有学生 (需要认证)
router.get('/', authenticate, async (req, res) => {
  try {
    const students = await Student.find().select('-todos');
    
    // 检查学生最后报告时间，如超过2分钟标记为离线
    const updatedStudents = students.map(student => {
      const lastReport = new Date(student.lastReportTime);
      const now = new Date();
      const diffMinutes = (now - lastReport) / (1000 * 60);
      
      return {
        ...student.toObject(),
        status: diffMinutes > 2 ? 'offline' : student.status
      };
    });
    
    res.json(updatedStudents);
  } catch (error) {
    console.error('获取学生列表失败:', error);
    res.status(500).json({ error: '获取学生列表失败' });
  }
});

// 获取特定学生 (需要认证)
router.get('/:studentId', authenticate, async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.studentId });
    
    if (!student) {
      return res.status(404).json({ error: '学生未找到' });
    }
    
    // 检查学生最后报告时间
    const lastReport = new Date(student.lastReportTime);
    const now = new Date();
    const diffMinutes = (now - lastReport) / (1000 * 60);
    
    const studentData = {
      ...student.toObject(),
      status: diffMinutes > 2 ? 'offline' : student.status
    };
    
    res.json(studentData);
  } catch (error) {
    console.error('获取学生信息失败:', error);
    res.status(500).json({ error: '获取学生信息失败' });
  }
});

// 获取学生的待办事项 (需要认证)
router.get('/:studentId/todos', authenticate, async (req, res) => {
  try {
    const student = await Student.findOne({ studentId: req.params.studentId });
    
    if (!student) {
      return res.status(404).json({ error: '学生未找到' });
    }
    
    res.json(student.todos || []);
  } catch (error) {
    console.error('获取学生待办事项失败:', error);
    res.status(500).json({ error: '获取学生待办事项失败' });
  }
});

// 接收学生报告 (无需认证，但需要API密钥)
router.post('/report', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const studentId = req.headers['x-student-id'];
    
    // 简单的API密钥验证 (生产环境应更复杂)
    if (!apiKey || apiKey !== process.env.STUDENT_API_KEY) {
      return res.status(401).json({ error: 'API密钥无效' });
    }
    
    if (!studentId || !req.body.studentId || studentId !== req.body.studentId) {
      return res.status(400).json({ error: '学生ID不匹配' });
    }
    
    const { 
      name, ipAddress, port, timestamp, data 
    } = req.body;
    
    // 更新或创建学生记录
    let student = await Student.findOne({ studentId });
    
    if (student) {
      // 更新现有学生
      student.name = name;
      student.ipAddress = ipAddress;
      student.port = port;
      student.status = 'online';
      student.lastReportTime = new Date(timestamp || Date.now());
      student.todoCount = data.todoCount || 0;
      student.todos = data.todos || [];
      student.registered = true;  // 更新注册状态
      
      if (data.testResults) {
        student.lastTestResults = {
          score: data.testsPassed * 10, // 简单计分方式
          totalPassed: data.testsPassed,
          totalFailed: data.testsTotal - data.testsPassed,
          tests: data.testResults
        };
      }
    } else {
      // 创建新学生
      // 如果学生不存在，不允许自注册
      return res.status(401).json({ 
        error: '未授权：学生ID未预先注册，请联系教师进行账号注册'
      });
      // 若允许自注册
      // student = new Student({
      //   studentId,
      //   name,
      //   ipAddress,
      //   port,
      //   status: 'online',
      //   lastReportTime: new Date(timestamp || Date.now()),
      //   todoCount: data.todoCount || 0,
      //   todos: data.todos || [],
      //   registered: true 
      // });
    }
    
    await student.save();
    
    // 确认接收并返回可能的命令
    res.status(200).json({ 
      message: '报告接收成功',
      timestamp: new Date().toISOString(),
      // 可以在这里返回命令给学生执行
      // command: 'RUN_TEST',
      // params: { testName: 'all' }
    });
  } catch (error) {
    console.error('处理学生报告失败:', error);
    res.status(500).json({ error: '处理报告失败' });
  }
});

// 发送命令到学生 (需要认证)
router.post('/:studentId/command', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { command, params } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: '缺少命令' });
    }
    
    // 存储命令到学生记录，待下次学生报告时获取
    const student = await Student.findOne({ studentId });
    
    if (!student) {
      return res.status(404).json({ error: '学生未找到' });
    }
    
    // 在此可以实现命令队列，这里简化处理
    student.pendingCommand = {
      command,
      params,
      issuedAt: new Date()
    };
    
    await student.save();
    
    res.json({ 
      message: `命令 ${command} 已排队等待学生下次报告时执行` 
    });
  } catch (error) {
    console.error('发送命令失败:', error);
    res.status(500).json({ error: '发送命令失败' });
  }
});

router.post('/test-report', (req, res) => {
  console.log('Test report endpoint reached');
  console.log('Headers:', req.headers);
  res.json({ success: true, message: 'Test endpoint working' });
});

module.exports = router;
