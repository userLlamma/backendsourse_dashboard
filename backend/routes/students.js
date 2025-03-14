// backend/routes/students.js
const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const HardwareSignature = require('../models/HardwareSignature');
const crypto = require('crypto');
const { authenticate } = require('../middleware/auth');
const keyAuth = require('../utils/keyAuthentication');

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

// 获取挑战码 (安全认证第一步)
router.get('/challenge/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // 验证学生ID是否存在
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: '学生ID不存在' });
    }
    
    // 生成随机挑战码
    const challenge = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟有效期
    
    // 保存挑战码到学生记录
    student.authChallenge = {
      challenge,
      expiresAt
    };
    await student.save();
    
    // 返回挑战码给客户端
    res.json({
      challenge,
      expiresAt
    });
  } catch (error) {
    console.error('生成挑战码失败:', error);
    res.status(500).json({ error: '生成挑战码失败' });
  }
});

// 接收学生报告 (包含硬件指纹和挑战响应)
// 整合的认证部分
router.post('/report', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const studentId = req.headers['x-student-id'];
    
    // 验证API密钥
    if (!apiKey || apiKey !== process.env.STUDENT_API_KEY) {
      return res.status(401).json({ error: 'API密钥无效' });
    }
    
    if (!studentId || !req.body.studentId || studentId !== req.body.studentId) {
      return res.status(400).json({ error: '学生ID不匹配' });
    }
    
    // 验证签名（公钥认证）
    const { signature, hardwareInfo } = req.body;
    
    if (!signature) {
      return res.status(400).json({ 
        error: '缺少签名',
        requiresAuth: true
      });
    }
    
    // 查找学生
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: '学生ID不存在' });
    }
    
    // 验证挑战码
    if (!student.authChallenge || 
        !student.authChallenge.challenge || 
        student.authChallenge.expiresAt < new Date()) {
      return res.status(401).json({ 
        error: '挑战码已过期或不存在',
        requiresAuth: true
      });
    }
    
    // 验证签名
    const authResult = await keyAuth.verifySignature(studentId, signature);
    
    if (!authResult.success) {
      return res.status(401).json({ 
        error: authResult.error,
        requiresAuth: true
      });
    }
    
    // 收集硬件信息（仅用于记录，不影响认证）
    if (hardwareInfo) {
      // 记录硬件信息
      const hwSignature = new HardwareSignature({
        student: student._id,
        signature: hardwareInfo,
        keyId: authResult.keyId,
        ipAddress: req.ip,
        timestamp: new Date()
      });
      
      await hwSignature.save();
      
      // 检查是否有异常情况（不影响认证结果）
      const unusualHardware = await checkUnusualHardware(authResult.keyId, hardwareInfo);
      if (unusualHardware) {
        // 记录异常但不拒绝认证
        console.log(`异常硬件使用: ${studentId} 使用密钥 ${authResult.keyId} 在不同硬件环境`);
      }
    }
    
    // 处理报告内容...
    // ...
  } catch (error) {
    // 错误处理...
  }
});

// 帮助函数：记录硬件签名
async function recordHardwareSignature(studentId, hardwareSignature) {
  try {
    // 创建指纹记录
    const signature = new HardwareSignature({
      student: studentId,
      signature: hardwareSignature,
      timestamp: new Date()
    });
    
    await signature.save();
    
    // 可选：检查异常模式（例如，短时间内多次切换硬件环境）
    const recentSignatures = await HardwareSignature
      .find({ student: studentId })
      .sort({ timestamp: -1 })
      .limit(10);
    
    // 这里可以添加更复杂的异常检测逻辑
    
    return true;
  } catch (error) {
    console.error('记录硬件签名失败:', error);
    return false;
  }
}

// 获取学生的硬件历史
router.get('/:studentId/hardware-history', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // 验证教师权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    // 查找学生
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: '学生未找到' });
    }
    
    // 获取硬件历史记录
    const hardwareHistory = await HardwareSignature.find({ student: student._id })
      .sort({ timestamp: -1 });
    
    res.json(hardwareHistory);
  } catch (error) {
    console.error('获取硬件历史失败:', error);
    res.status(500).json({ error: '获取硬件历史失败' });
  }
});

// 标记硬件签名状态
router.post('/:studentId/hardware/:signatureId/flag', authenticate, async (req, res) => {
  try {
    const { studentId, signatureId } = req.params;
    const { suspicious, reason } = req.body;
    
    // 验证教师权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    // 更新硬件签名状态
    const signature = await HardwareSignature.findById(signatureId);
    if (!signature) {
      return res.status(404).json({ error: '硬件签名记录未找到' });
    }
    
    signature.suspicious = suspicious;
    signature.notes = reason || (suspicious ? '手动标记为可疑' : '手动标记为正常');
    await signature.save();
    
    res.json({ success: true, message: `硬件签名已${suspicious ? '标记为可疑' : '标记为正常'}` });
  } catch (error) {
    console.error('更新硬件签名状态失败:', error);
    res.status(500).json({ error: '更新硬件签名状态失败' });
  }
});

// 获取公钥认证挑战码
router.get('/auth/challenge/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // 生成挑战码
    const { challenge, expiresAt } = await keyAuth.generateChallenge(studentId);
    
    res.json({
      challenge,
      expiresAt,
      message: '请使用你的私钥对挑战码进行签名，并在5分钟内提交响应'
    });
  } catch (error) {
    console.error('生成挑战码失败:', error);
    res.status(500).json({ error: error.message || '生成挑战码失败' });
  }
});

// 注册公钥
router.post('/auth/register-key/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { publicKey, keyName, signature, challenge } = req.body;
    
    // 验证请求
    if (!publicKey || !signature || !challenge) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 查找学生
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: '学生未找到' });
    }
    
    // 注册公钥（首次注册不需要验证）
    const result = await keyAuth.registerPublicKey(studentId, publicKey, keyName || 'My Device');
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.status(201).json({
      success: true,
      keyId: result.keyId,
      message: '公钥注册成功'
    });
  } catch (error) {
    console.error('注册公钥失败:', error);
    res.status(500).json({ error: error.message || '注册公钥失败' });
  }
});

// 提交签名响应
router.post('/auth/verify/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { signature } = req.body;
    
    if (!signature) {
      return res.status(400).json({ error: '缺少签名' });
    }
    
    // 验证签名
    const result = await keyAuth.verifySignature(studentId, signature);
    
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: '认证成功',
      keyName: result.keyName
    });
  } catch (error) {
    console.error('验证签名失败:', error);
    res.status(401).json({ error: error.message || '验证签名失败' });
  }
});

// 获取学生的密钥列表
router.get('/:studentId/keys', authenticate, async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // 验证权限（教师或学生本人）
    if (req.user.role !== 'admin' && req.user.role !== 'teacher' && 
        (req.user.role !== 'student' || req.user.studentId !== studentId)) {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const keys = await keyAuth.getStudentKeys(studentId);
    res.json(keys);
  } catch (error) {
    console.error('获取密钥失败:', error);
    res.status(500).json({ error: '获取密钥失败' });
  }
});

// 吊销公钥
router.post('/:studentId/keys/:keyId/revoke', authenticate, async (req, res) => {
  try {
    const { studentId, keyId } = req.params;
    const { reason } = req.body;
    
    // 验证权限（教师或学生本人）
    if (req.user.role !== 'admin' && req.user.role !== 'teacher' && 
        (req.user.role !== 'student' || req.user.studentId !== studentId)) {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const result = await keyAuth.revokePublicKey(keyId, reason, req.user.id);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      message: '公钥已吊销'
    });
  } catch (error) {
    console.error('吊销公钥失败:', error);
    res.status(500).json({ error: '吊销公钥失败' });
  }
});

module.exports = router;
