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

// 接收学生报告 (强制公钥验证)
router.post('/report', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const studentId = req.headers['x-student-id'];
    
    // 基本验证: API密钥
    if (!apiKey || apiKey !== process.env.STUDENT_API_KEY) {
      return res.status(401).json({ error: 'API密钥无效' });
    }
    
    // 基本验证: 学号一致性
    if (!studentId || !req.body.studentId || studentId !== req.body.studentId) {
      return res.status(400).json({ error: '学生ID不匹配' });
    }
    
    // 获取签名和硬件信息
    const { signature, hardwareInfo } = req.body;
    
    // 查找学生记录
    let student = await Student.findOne({ studentId });
    
    // 如果学生不存在，不允许自注册
    if (!student) {
      return res.status(401).json({ 
        error: '未授权：学生ID未预先注册，请联系教师进行账号注册'
      });
    }
    
    // 1. 认证部分 - 单独处理，和数据库更新解耦
    let authSuccessful = false;
    let needsRegistration = false;
    let pendingCommand = null;
    
    // 检查学生是否已注册
    if (student.registered) {
      // 已注册学生必须提供有效签名
      if (!signature) {
        return res.status(401).json({ 
          error: '需要签名验证',
          requiresAuth: true,
          challenge: (await keyAuth.generateChallenge(studentId)).challenge
        });
      }
      
      // 如果教师端已经重置密钥，则立刻返回，要求学生重新注册
      if (student.needsReauthentication) {
        return res.status(401).json({ 
          error: '教师已重置您的密钥，请重新注册',
          requiresReregistration: true
        });
      }

      // 验证签名
      const authResult = await keyAuth.verifySignature(studentId, signature);
      
      if (!authResult.success) {
        return res.status(401).json({ 
          error: authResult.error || '签名验证失败',
          requiresAuth: true,
          challenge: (await keyAuth.generateChallenge(studentId)).challenge
        });
      }
      
      // 签名验证通过
      console.log(`学生 ${studentId} 签名验证通过，使用密钥: ${authResult.keyId}`);
      authSuccessful = true;
    } else {
      // 首次报告，不需要签名，但需要设置为已注册
      console.log(`学生 ${studentId} 首次报告，设置为已注册`);
      needsRegistration = true;
    }
    
    // 如果学生有待处理命令，获取它（但不立即删除）
    if (student.pendingCommand && student.pendingCommand.command) {
      pendingCommand = {
        command: student.pendingCommand.command,
        params: student.pendingCommand.params
      };
    }
    
    // 2. 记录硬件信息 (如果提供)
    if (hardwareInfo) {
      try {
        // 创建硬件签名记录
        const hwSignature = new HardwareSignature({
          student: student._id,
          signature: hardwareInfo,
          ipAddress: req.ip
        });
        
        await hwSignature.save();
        
        // 学生首次报告且没有公钥，自动注册公钥
        if (needsRegistration && signature && hardwareInfo.publicKey) {
          await keyAuth.registerPublicKey(
            studentId, 
            hardwareInfo.publicKey,
            hardwareInfo.hostname || '首次注册设备'
          );
        }
      } catch (hwError) {
        console.error('记录硬件信息失败:', hwError);
        // 继续处理请求，不因硬件信息记录失败而中断
      }
    }
    
    // 3. 处理学生报告数据 - 使用 findOneAndUpdate 来避免版本冲突
    const { name, ipAddress, port, timestamp, data } = req.body;
    
    // 创建更新对象
    const updateData = {
      name,
      ipAddress,
      port,
      status: 'online',
      lastReportTime: new Date(timestamp || Date.now()),
      todoCount: data.todoCount || 0,
      todos: data.todos || []
    };
    
    // 如果是首次注册，设置registered标志
    if (needsRegistration) {
      updateData.registered = true;
    }
    
    // 如果有测试结果，添加到更新中
    if (data.testResults) {
      updateData.lastTestResults = {
        score: data.testsPassed * 10, // 简单计分方式
        totalPassed: data.testsPassed,
        totalFailed: data.testsTotal - data.testsPassed,
        tests: data.testResults,
        timestamp: new Date()
      };
    }
    
    // 执行原子更新操作
    const updateOptions = { new: true }; // 返回更新后的文档
    
    // 如果有待处理命令，同时清除它
    if (pendingCommand) {
      updateData.pendingCommand = null;
    }
    
    // 执行原子更新
    await Student.findOneAndUpdate(
      { studentId },
      { $set: updateData },
      updateOptions
    );
    
    // 4. 返回响应，包括可能的命令
    let response = { 
      message: '报告接收成功',
      timestamp: new Date().toISOString()
    };
    
    // 如果有待处理命令，添加到响应中
    if (pendingCommand) {
      response.command = pendingCommand.command;
      response.params = pendingCommand.params;
    }
    
    // 返回响应
    res.status(200).json(response);
    
  } catch (error) {
    console.error('处理学生报告失败:', error);
    res.status(500).json({ error: '处理报告失败' });
  }
});

// 更新测试评分 (需要认证)
router.post('/:studentId/update-test-scores', authenticate, async (req, res) => {
  try {
    // 验证权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { studentId } = req.params;
    const { tests, totalScore, maxPossibleScore } = req.body;
    
    // 查找学生
    const student = await Student.findOne({ studentId });
    
    if (!student) {
      return res.status(404).json({ error: '学生未找到' });
    }
    
    // 更新测试结果
    if (!student.lastTestResults) {
      student.lastTestResults = {
        tests: [],
        totalPassed: 0,
        totalFailed: 0,
        timestamp: new Date()
      };
    }
    
    student.lastTestResults.tests = tests;
    student.lastTestResults.score = totalScore;
    student.lastTestResults.maxPossibleScore = maxPossibleScore;
    
    await student.save();
    
    res.json({ 
      success: true, 
      message: '测试评分已更新',
      score: totalScore,
      maxPossibleScore
    });
  } catch (error) {
    console.error('更新测试评分失败:', error);
    res.status(500).json({ error: '更新测试评分失败' });
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
