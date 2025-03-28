// backend/routes/autoGrading.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const Student = require('../models/Student');
const SystemConfig = require('../models/SystemConfig');
const APIScoreModel = require('../utils/APIScoreModel');
const CloudAdapter = require('../utils/cloudAdapter');
const TrainingDataRepository = require('../utils/TrainingDataRepository');

// 初始化评分模型和云API适配器
const scoreModel = new APIScoreModel();
const cloudAdapter = new CloudAdapter();
const trainingRepo = new TrainingDataRepository();

// 确保系统配置已初始化
let systemConfigInitialized = false;
const initializeSystemConfig = async () => {
  if (!systemConfigInitialized) {
    await SystemConfig.initialize();
    systemConfigInitialized = true;
  }
};

// 初始化中间件
router.use(async (req, res, next) => {
  await initializeSystemConfig();
  next();
});

/**
 * 获取自动评分系统状态
 * GET /api/auto-grading/status
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    // 验证用户权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    // 获取系统配置
    const config = await SystemConfig.findOne({ key: 'auto_grading' });
    
    // 获取模型指标
    const modelMetrics = scoreModel.getMetrics();
    
    // 获取云API使用情况
    const cloudUsage = cloudAdapter.getUsage();
    
    // 获取训练数据统计
    const trainingStats = await trainingRepo.getStatistics();
    
    // 组合状态信息
    const status = {
      enabled: config?.autoGradingEnabled || false,
      model: {
        ...modelMetrics,
        settings: config?.model || {}
      },
      cloudApi: {
        ...config?.cloudApi,
        usage: cloudUsage
      },
      stats: config?.stats || {
        totalEvaluations: 0,
        cloudApiCalls: 0,
        teacherOverrides: 0
      },
      trainingStats,
      referenceSolutions: config?.referenceSolutions || []
    };
    
    res.json(status);
  } catch (error) {
    console.error('获取自动评分状态失败:', error);
    res.status(500).json({ error: '获取自动评分状态失败' });
  }
});

/**
 * 更新自动评分系统配置
 * PUT /api/auto-grading/config
 */
router.put('/config', authenticate, async (req, res) => {
  try {
    // 验证用户权限
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { enabled, cloudApi, model } = req.body;
    
    // 创建更新对象
    const updates = {};
    
    // 更新启用状态
    if (enabled !== undefined) {
      updates.autoGradingEnabled = enabled;
    }
    
    // 更新云API设置
    if (cloudApi) {
      updates.cloudApi = cloudApi;
    }
    
    // 更新模型设置
    if (model) {
      updates.model = model;
    }
    
    // 执行更新
    const updatedConfig = await SystemConfig.updateConfig(updates);
    
    res.json({ success: true, config: updatedConfig });
  } catch (error) {
    console.error('更新自动评分配置失败:', error);
    res.status(500).json({ error: '更新自动评分配置失败' });
  }
});

/**
 * 设置参考解决方案
 * POST /api/auto-grading/reference-solution
 */
router.post('/reference-solution', authenticate, async (req, res) => {
  try {
    // 验证用户权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { studentId, testInfo } = req.body;
    
    // 验证必要参数
    if (!studentId || !testInfo) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 检查学生是否存在
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: '学生未找到' });
    }
    
    // 添加参考解决方案
    const result = await SystemConfig.addReferenceSolution(testInfo, studentId);
    
    res.json({ 
      success: true, 
      message: '参考解决方案已设置', 
      referenceSolutions: result.referenceSolutions 
    });
  } catch (error) {
    console.error('设置参考解决方案失败:', error);
    res.status(500).json({ error: '设置参考解决方案失败' });
  }
});

/**
 * 获取API响应的自动评分
 * POST /api/auto-grading/score
 */
router.post('/score', authenticate, async (req, res) => {
  try {
    // 验证用户权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { studentResponse, testCase, studentId } = req.body;
    
    // 验证必要参数
    if (!studentResponse || !testCase) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 获取系统配置
    const config = await SystemConfig.findOne({ key: 'auto_grading' });
    
    // 检查自动评分是否启用
    if (!config || !config.autoGradingEnabled) {
      return res.status(403).json({ 
        error: '自动评分系统已禁用',
        message: '请联系管理员启用自动评分系统' 
      });
    }
    
    // 查找参考解决方案
    const referenceSolution = config.referenceSolutions.find(sol => 
      sol.testName === testCase.name && 
      sol.endpoint === testCase.endpoint && 
      sol.method === testCase.method
    );
    
    // 如果未找到参考解决方案，返回错误
    if (!referenceSolution) {
      return res.status(404).json({ 
        error: '未找到参考解决方案',
        message: '请先设置此测试的参考解决方案' 
      });
    }
    
    // 获取参考解决方案的学生响应
    const referenceStudent = await Student.findOne({ studentId: referenceSolution.studentId });
    
    if (!referenceStudent || !referenceStudent.lastTestResults) {
      return res.status(404).json({ error: '参考解决方案数据不可用' });
    }
    
    // 查找参考测试结果
    const referenceTest = referenceStudent.lastTestResults.tests.find(test => 
      test.name === testCase.name && test.endpoint === testCase.endpoint
    );
    
    if (!referenceTest || !referenceTest.response) {
      return res.status(404).json({ error: '参考解决方案未包含有效响应' });
    }
    
    const referenceResponse = referenceTest.response;
    
    // 实施三重评分策略
    
    // 1. 获取本地模型评分
    const modelScoreResult = scoreModel.scoreResponse(studentResponse, referenceResponse, testCase);
    
    // 2. 获取云API评分(如果启用)
    let cloudScoreResult = null;
    if (config.cloudApi.enabled) {
      try {
        // 更新统计信息
        await SystemConfig.updateStats({ cloudApiCalls: config.stats.cloudApiCalls + 1 });
        
        // 调用云API
        cloudScoreResult = await cloudAdapter.getScore(studentResponse, referenceResponse, testCase);
        
        // 存储云API评分数据
        if (cloudScoreResult.success) {
          await trainingRepo.saveCloudApiScore({
            testName: testCase.name,
            endpoint: testCase.endpoint,
            method: testCase.method,
            studentId,
            studentResponse,
            referenceResponse,
            cloudScore: cloudScoreResult.score,
            explanation: cloudScoreResult.explanation,
            timestamp: new Date()
          });
        }
      } catch (cloudError) {
        console.error('云API评分失败:', cloudError);
        // 继续处理，使用本地模型评分
      }
    }
    
    // 3. 最终评分 (使用本地模型中的组合逻辑)
    const finalScoreResult = scoreModel.scoreResponse(
      studentResponse, 
      referenceResponse, 
      testCase, 
      { cloudScore: cloudScoreResult?.success ? cloudScoreResult.score : null }
    );
    
    // 记录评分
    await SystemConfig.recordEvaluation(finalScoreResult.score);
    
    // 存储自动评分结果
    await trainingRepo.saveAutoGradingResult({
      testName: testCase.name,
      endpoint: testCase.endpoint,
      method: testCase.method,
      studentId,
      studentResponse,
      referenceResponse,
      modelScore: modelScoreResult.score,
      cloudScore: cloudScoreResult?.score,
      finalScore: finalScoreResult.score,
      featureValues: finalScoreResult.featureValues,
      weights: finalScoreResult.details.weights,
      timestamp: new Date()
    });
    
    // 准备响应
    const response = {
      score: finalScoreResult.score,
      confidence: finalScoreResult.confidence,
      details: {
        modelScore: modelScoreResult.score,
        cloudScore: cloudScoreResult?.score,
        featureValues: finalScoreResult.featureValues,
        featureNames: finalScoreResult.details.featureNames,
        weights: finalScoreResult.details.weights
      },
      explanation: cloudScoreResult?.explanation || '根据API结构和内容评估'
    };
    
    // 如果启用了调试模式，添加更多详细信息
    if (req.query.debug === 'true' && (req.user.role === 'admin')) {
      response.debug = {
        referenceResponse,
        modelDetails: finalScoreResult.details,
        cloudDetails: cloudScoreResult
      };
    }
    
    res.json(response);
  } catch (error) {
    console.error('自动评分失败:', error);
    res.status(500).json({ error: '自动评分失败' });
  }
});

/**
 * 学习API响应评分
 * POST /api/auto-grading/learn
 */
router.post('/learn', authenticate, async (req, res) => {
  try {
    // 验证用户权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { studentResponse, referenceResponse, teacherScore, testCase } = req.body;
    
    // 验证必要参数
    if (!studentResponse || !referenceResponse || teacherScore === undefined || !testCase) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 验证分数范围
    if (teacherScore < 0 || teacherScore > 10) {
      return res.status(400).json({ error: '教师评分必须在0-10之间' });
    }
    
    // 执行学习
    const learnResult = scoreModel.learn(studentResponse, referenceResponse, teacherScore, testCase);
    
    // 更新统计信息
    const config = await SystemConfig.findOne({ key: 'auto_grading' });
    if (config) {
      await SystemConfig.updateStats({
        teacherOverrides: config.stats.teacherOverrides + 1
      });
    }
    
    // 存储教师评分数据
    await trainingRepo.saveTeacherScore({
      testName: testCase.name,
      endpoint: testCase.endpoint,
      method: testCase.method,
      studentResponse,
      referenceResponse,
      teacherScore,
      autoScore: learnResult.autoScore,
      scoreDiff: learnResult.scoreDiff,
      added: learnResult.added,
      teacherId: req.user.id,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: learnResult.added ? '模型已成功学习新样本' : '样本差异太小，未添加到训练集',
      modelStatus: {
        sampleCount: learnResult.currentSamples,
        sufficientData: learnResult.sufficientData,
        scoreDifference: learnResult.scoreDiff
      }
    });
  } catch (error) {
    console.error('学习失败:', error);
    res.status(500).json({ error: '学习失败' });
  }
});

/**
 * 重新训练模型
 * POST /api/auto-grading/train
 */
router.post('/train', authenticate, async (req, res) => {
  try {
    // 验证用户权限
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    // 获取当前指标
    const beforeMetrics = scoreModel.getMetrics();
    
    // 训练模型
    const trainSuccess = scoreModel.trainModel();
    
    if (!trainSuccess) {
      return res.status(400).json({ 
        error: '训练失败',
        message: '训练样本不足，需要至少3个样本' 
      });
    }
    
    // 获取更新后的指标
    const afterMetrics = scoreModel.getMetrics();
    
    // 更新系统配置中的模型指标
    await SystemConfig.updateConfig({
      model: {
        lastTrainingTime: new Date(),
        sampleCount: afterMetrics.sampleCount,
        accuracy: afterMetrics.confidenceScore
      }
    });
    
    res.json({
      success: true,
      message: '模型训练成功',
      metrics: {
        before: {
          sampleCount: beforeMetrics.sampleCount,
          accuracy: beforeMetrics.confidenceScore
        },
        after: {
          sampleCount: afterMetrics.sampleCount,
          accuracy: afterMetrics.confidenceScore,
          averageError: afterMetrics.averageError
        }
      }
    });
  } catch (error) {
    console.error('训练模型失败:', error);
    res.status(500).json({ error: '训练模型失败' });
  }
});

/**
 * 重置模型
 * POST /api/auto-grading/reset
 */
router.post('/reset', authenticate, async (req, res) => {
  try {
    // 验证用户权限
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    // 重置模型
    const resetSuccess = scoreModel.reset();
    
    if (!resetSuccess) {
      return res.status(500).json({ error: '重置模型失败' });
    }
    
    // 更新系统配置
    await SystemConfig.updateConfig({
      model: {
        lastTrainingTime: null,
        sampleCount: 0,
        accuracy: null
      }
    });
    
    // 重置统计信息
    await SystemConfig.updateStats({
      totalEvaluations: 0,
      teacherOverrides: 0
    });
    
    res.json({
      success: true,
      message: '模型已重置'
    });
  } catch (error) {
    console.error('重置模型失败:', error);
    res.status(500).json({ error: '重置模型失败' });
  }
});

/**
 * 清除云API缓存
 * POST /api/auto-grading/clear-cache
 */
router.post('/clear-cache', authenticate, async (req, res) => {
  try {
    // 验证用户权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    // 清除缓存
    const clearSuccess = cloudAdapter.clearCache();
    
    if (!clearSuccess) {
      return res.status(500).json({ error: '清除缓存失败' });
    }
    
    res.json({
      success: true,
      message: '云API缓存已清除'
    });
  } catch (error) {
    console.error('清除缓存失败:', error);
    res.status(500).json({ error: '清除缓存失败' });
  }
});

/**
 * 修改学生测试评分
 * POST /api/auto-grading/update-test-score
 */
router.post('/update-test-score', authenticate, async (req, res) => {
  try {
    // 验证用户权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { studentId, testName, score, teacherComment } = req.body;
    
    // 验证必要参数
    if (!studentId || !testName || score === undefined) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    
    // 查找学生
    const student = await Student.findOne({ studentId });
    
    if (!student) {
      return res.status(404).json({ error: '学生未找到' });
    }
    
    // 确保学生有测试结果
    if (!student.lastTestResults || !student.lastTestResults.tests) {
      return res.status(404).json({ error: '学生无测试结果' });
    }
    
    // 查找并更新测试
    const testIndex = student.lastTestResults.tests.findIndex(test => test.name === testName);
    
    if (testIndex === -1) {
      return res.status(404).json({ error: '未找到指定测试' });
    }
    
    // 保存当前的测试结果进行比较
    const currentTest = student.lastTestResults.tests[testIndex];
    const currentScore = currentTest.score?.value || 0;
    
    // 更新测试评分
    student.lastTestResults.tests[testIndex].score = {
      ...(student.lastTestResults.tests[testIndex].score || {}),
      value: score,
      gradedBy: req.user.id,
      gradedAt: new Date(),
      comments: teacherComment || '教师手动评分'
    };
    
    // 更新总分
    let totalScore = 0;
    let maxPossibleScore = 0;
    
    student.lastTestResults.tests.forEach(test => {
      totalScore += test.score?.value || 0;
      maxPossibleScore += test.score?.maxValue || 10;
    });
    
    student.lastTestResults.score = totalScore;
    student.lastTestResults.maxPossibleScore = maxPossibleScore;
    
    // 保存更新
    await student.save();
    
    // 学习模式 - 如果开启了自动评分和学习
    const config = await SystemConfig.findOne({ key: 'auto_grading' });
    
    if (config && config.autoGradingEnabled && 
        currentTest.response && Math.abs(currentScore - score) > 0.5) {
      // 首先找到参考解决方案
      const referenceSolution = config.referenceSolutions.find(sol => 
        sol.testName === testName
      );
      
      if (referenceSolution) {
        // 获取参考响应
        const referenceStudent = await Student.findOne({ studentId: referenceSolution.studentId });
        
        if (referenceStudent && referenceStudent.lastTestResults) {
          const referenceTest = referenceStudent.lastTestResults.tests.find(test => 
            test.name === testName
          );
          
          if (referenceTest && referenceTest.response && currentTest.response) {
            // 创建测试用例
            const testCase = {
              name: testName,
              endpoint: currentTest.endpoint,
              method: currentTest.method
            };
            
            // 执行学习
            try {
              const learnResult = scoreModel.learn(
                currentTest.response,
                referenceTest.response,
                score,
                testCase
              );
              
              // 存储教师评分数据
              await trainingRepo.saveTeacherScore({
                testName,
                endpoint: currentTest.endpoint,
                method: currentTest.method,
                studentId,
                studentResponse: currentTest.response,
                referenceResponse: referenceTest.response,
                teacherScore: score,
                autoScore: currentScore,
                scoreDiff: Math.abs(currentScore - score),
                added: learnResult.added,
                teacherId: req.user.id,
                timestamp: new Date(),
                source: 'test_update'
              });
              
              console.log(`自动学习: 测试 ${testName} 的评分从 ${currentScore} 更新为 ${score}`);
            } catch (learnError) {
              console.error('自动学习失败:', learnError);
            }
          }
        }
      }
    }
    
    res.json({
      success: true,
      message: '测试评分已更新',
      updatedScore: {
        test: testName,
        score,
        totalScore,
        maxPossibleScore
      }
    });
  } catch (error) {
    console.error('更新测试评分失败:', error);
    res.status(500).json({ error: '更新测试评分失败' });
  }
});

/**
 * 获取训练数据历史记录
 * GET /api/auto-grading/training-data
 */
router.get('/training-data', authenticate, async (req, res) => {
  try {
    // 验证用户权限
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { page = 1, limit = 20, type } = req.query;
    
    // 获取训练数据历史
    const data = await trainingRepo.getTrainingData({
      page: parseInt(page),
      limit: parseInt(limit),
      type: type || 'all'
    });
    
    res.json(data);
  } catch (error) {
    console.error('获取训练数据失败:', error);
    res.status(500).json({ error: '获取训练数据失败' });
  }
});

/**
 * 导出训练数据
 * GET /api/auto-grading/export-training-data
 */
router.get('/export-training-data', authenticate, async (req, res) => {
  try {
    // 验证用户权限
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    // 导出训练数据
    const data = await trainingRepo.exportAllData();
    
    // 设置响应头，作为JSON文件下载
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=api_training_data_${new Date().toISOString().split('T')[0]}.json`);
    
    res.json(data);
  } catch (error) {
    console.error('导出训练数据失败:', error);
    res.status(500).json({ error: '导出训练数据失败' });
  }
});

/**
 * 导入训练数据
 * POST /api/auto-grading/import-training-data
 */
router.post('/import-training-data', authenticate, async (req, res) => {
  try {
    // 验证用户权限
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    const { data } = req.body;
    
    if (!data || !Array.isArray(data.teacherScores) || !Array.isArray(data.cloudApiScores) || !Array.isArray(data.autoGradingResults)) {
      return res.status(400).json({ error: '数据格式无效' });
    }
    
    // 导入训练数据
    const result = await trainingRepo.importData(data);
    
    // 导入完成后重新训练模型
    if (result.success && result.totalImported > 0) {
      try {
        scoreModel.trainModel();
      } catch (trainError) {
        console.error('导入后训练模型失败:', trainError);
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('导入训练数据失败:', error);
    res.status(500).json({ error: '导入训练数据失败' });
  }
});

module.exports = router;