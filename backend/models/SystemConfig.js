// backend/models/SystemConfig.js
const mongoose = require('mongoose');

/**
 * 系统配置模型
 * 用于存储自动评分系统的配置和状态
 */
const SystemConfigSchema = new mongoose.Schema({
  // 配置标识符
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // 基本配置
  autoGradingEnabled: {
    type: Boolean,
    default: true
  },
  
  referenceSolutions: [{
    testName: String,
    endpoint: String,
    method: String,
    studentId: String,
    responseId: String
  }],
  
  // 云API设置
  cloudApi: {
    enabled: {
      type: Boolean,
      default: true
    },
    provider: {
      type: String,
      enum: ['siliconflow', 'openai', 'none'],
      default: 'siliconflow'
    },
    dailyLimit: {
      type: Number,
      default: 20
    },
    model: String
  },
  
  // 模型设置
  model: {
    minSamples: {
      type: Number,
      default: 3
    },
    lastTrainingTime: Date,
    sampleCount: {
      type: Number,
      default: 0
    },
    accuracy: Number,
    ruleWeight: {
      type: Number,
      default: 0.3
    },
    cloudWeight: {
      type: Number,
      default: 0.6
    },
    modelWeight: {
      type: Number,
      default: 0.1
    }
  },
  
  // 使用统计
  stats: {
    totalEvaluations: {
      type: Number,
      default: 0
    },
    cloudApiCalls: {
      type: Number,
      default: 0
    },
    teacherOverrides: {
      type: Number,
      default: 0
    },
    averageAccuracy: Number,
    lastUpdated: Date
  }
}, 
{
  timestamps: true
});

// 初始化系统配置
SystemConfigSchema.statics.initialize = async function() {
  // 检查是否已存在配置
  const existingConfig = await this.findOne({ key: 'auto_grading' });
  
  if (!existingConfig) {
    // 创建默认配置
    const defaultConfig = {
      key: 'auto_grading',
      autoGradingEnabled: true,
      cloudApi: {
        enabled: process.env.ENABLE_CLOUD_API === 'true',
        provider: process.env.PREFERRED_CLOUD_API || 'siliconflow',
        dailyLimit: parseInt(process.env.CLOUD_API_DAILY_LIMIT || '20'),
        model: process.env.CLOUD_API_MODEL || 'Qwen/QwQ-32B'
      },
      model: {
        minSamples: 3,
        sampleCount: 0,
        ruleWeight: 0.3,
        cloudWeight: 0.6,
        modelWeight: 0.1
      },
      stats: {
        totalEvaluations: 0,
        cloudApiCalls: 0,
        teacherOverrides: 0,
        lastUpdated: new Date()
      }
    };
    
    await this.create(defaultConfig);
    console.log('已创建默认系统配置');
    return defaultConfig;
  }
  
  return existingConfig;
};

// 更新配置
SystemConfigSchema.statics.updateConfig = async function(updates) {
  return await this.findOneAndUpdate(
    { key: 'auto_grading' },
    { $set: updates },
    { new: true, upsert: true }
  );
};

// 更新统计信息
SystemConfigSchema.statics.updateStats = async function(updates) {
  const config = await this.findOne({ key: 'auto_grading' });
  
  if (!config) {
    await this.initialize();
    return this.updateStats(updates);
  }
  
  // 更新统计信息
  const stats = { ...config.stats, ...updates, lastUpdated: new Date() };
  
  return await this.findOneAndUpdate(
    { key: 'auto_grading' },
    { $set: { stats } },
    { new: true }
  );
};

// 记录评分结果
SystemConfigSchema.statics.recordEvaluation = async function(autoScore, teacherScore) {
  const config = await this.findOne({ key: 'auto_grading' });
  
  if (!config) {
    await this.initialize();
    return this.recordEvaluation(autoScore, teacherScore);
  }
  
  const stats = { ...config.stats };
  stats.totalEvaluations += 1;
  
  // 检查是否有教师覆盖
  if (teacherScore !== undefined && Math.abs(autoScore - teacherScore) > 0.5) {
    stats.teacherOverrides += 1;
  }
  
  // 更新平均准确度
  if (teacherScore !== undefined) {
    const error = Math.abs(autoScore - teacherScore) / 10; // 归一化为0-1
    const accuracy = 1 - error;
    
    if (stats.averageAccuracy === undefined) {
      stats.averageAccuracy = accuracy;
    } else {
      // 平滑更新准确度
      stats.averageAccuracy = stats.averageAccuracy * 0.9 + accuracy * 0.1;
    }
  }
  
  return await this.findOneAndUpdate(
    { key: 'auto_grading' },
    { $set: { stats } },
    { new: true }
  );
};

// 添加参考解决方案
SystemConfigSchema.statics.addReferenceSolution = async function(testInfo, studentId) {
  // 查找是否已存在该测试的参考解决方案
  const config = await this.findOne({ key: 'auto_grading' });
  
  if (!config) {
    await this.initialize();
    return this.addReferenceSolution(testInfo, studentId);
  }
  
  const referenceSolutions = [...(config.referenceSolutions || [])];
  
  // 检查是否已存在相同测试
  const existingIndex = referenceSolutions.findIndex(sol => 
    sol.testName === testInfo.name && sol.endpoint === testInfo.endpoint && sol.method === testInfo.method
  );
  
  if (existingIndex >= 0) {
    // 更新现有记录
    referenceSolutions[existingIndex] = {
      testName: testInfo.name,
      endpoint: testInfo.endpoint,
      method: testInfo.method,
      studentId,
      responseId: testInfo.id || Date.now().toString()
    };
  } else {
    // 添加新记录
    referenceSolutions.push({
      testName: testInfo.name,
      endpoint: testInfo.endpoint,
      method: testInfo.method,
      studentId,
      responseId: testInfo.id || Date.now().toString()
    });
  }
  
  return await this.findOneAndUpdate(
    { key: 'auto_grading' },
    { $set: { referenceSolutions } },
    { new: true }
  );
};

const SystemConfig = mongoose.model('SystemConfig', SystemConfigSchema);

module.exports = SystemConfig;