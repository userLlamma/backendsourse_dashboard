// backend/utils/TrainingDataRepository.js
const mongoose = require('mongoose');

/**
 * 教师评分记录模型
 * 存储教师对API响应的评分
 */
const TeacherScoreSchema = new mongoose.Schema({
  testName: {
    type: String,
    required: true,
    index: true
  },
  endpoint: String,
  method: String,
  studentId: String,
  studentResponse: Object,
  referenceResponse: Object,
  teacherScore: {
    type: Number,
    required: true
  },
  autoScore: Number,
  scoreDiff: Number,
  added: Boolean,
  teacherId: mongoose.Schema.Types.ObjectId,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  source: {
    type: String,
    enum: ['learn', 'test_update', 'import'],
    default: 'learn'
  }
}, { timestamps: true });

/**
 * 云API评分记录模型
 * 存储云API对API响应的评分
 */
const CloudApiScoreSchema = new mongoose.Schema({
  testName: {
    type: String,
    required: true,
    index: true
  },
  endpoint: String,
  method: String,
  studentId: String,
  studentResponse: Object,
  referenceResponse: Object,
  cloudScore: {
    type: Number,
    required: true
  },
  explanation: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  provider: {
    type: String,
    default: 'siliconflow'
  }
}, { timestamps: true });

/**
 * 自动评分结果模型
 * 存储系统对API响应的自动评分结果
 */
const AutoGradingResultSchema = new mongoose.Schema({
  testName: {
    type: String,
    required: true,
    index: true
  },
  endpoint: String,
  method: String,
  studentId: String,
  studentResponse: Object,
  referenceResponse: Object,
  modelScore: Number,
  cloudScore: Number,
  finalScore: {
    type: Number,
    required: true
  },
  featureValues: [Number],
  weights: Object,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

/**
 * 训练数据仓库
 * 用于存储和管理自动评分系统的训练数据
 */
class TrainingDataRepository {
  constructor() {
    // 确保模型只被创建一次
    this.TeacherScore = mongoose.models.TeacherScore || mongoose.model('TeacherScore', TeacherScoreSchema);
    this.CloudApiScore = mongoose.models.CloudApiScore || mongoose.model('CloudApiScore', CloudApiScoreSchema);
    this.AutoGradingResult = mongoose.models.AutoGradingResult || mongoose.model('AutoGradingResult', AutoGradingResultSchema);
  }

  /**
   * 保存教师评分
   * @param {Object} data - 教师评分数据
   * @returns {Promise<Object>} 保存的记录
   */
  async saveTeacherScore(data) {
    try {
      const teacherScore = new this.TeacherScore(data);
      return await teacherScore.save();
    } catch (error) {
      console.error('保存教师评分失败:', error);
      throw error;
    }
  }

  /**
   * 保存云API评分
   * @param {Object} data - 云API评分数据
   * @returns {Promise<Object>} 保存的记录
   */
  async saveCloudApiScore(data) {
    try {
      const cloudApiScore = new this.CloudApiScore(data);
      return await cloudApiScore.save();
    } catch (error) {
      console.error('保存云API评分失败:', error);
      throw error;
    }
  }

  /**
   * 保存自动评分结果
   * @param {Object} data - 自动评分结果数据
   * @returns {Promise<Object>} 保存的记录
   */
  async saveAutoGradingResult(data) {
    try {
      const autoGradingResult = new this.AutoGradingResult(data);
      return await autoGradingResult.save();
    } catch (error) {
      console.error('保存自动评分结果失败:', error);
      throw error;
    }
  }

  /**
   * 获取训练数据统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStatistics() {
    try {
      const [teacherScoreCount, cloudApiScoreCount, autoGradingResultCount] = await Promise.all([
        this.TeacherScore.countDocuments(),
        this.CloudApiScore.countDocuments(),
        this.AutoGradingResult.countDocuments()
      ]);
      
      // 获取最近的教师评分
      const recentTeacherScores = await this.TeacherScore.find()
        .sort({ timestamp: -1 })
        .limit(5)
        .select('testName endpoint teacherScore autoScore scoreDiff timestamp')
        .lean();
      
      // 按测试类型分组统计教师评分
      const testStats = await this.TeacherScore.aggregate([
        {
          $group: {
            _id: '$testName',
            count: { $sum: 1 },
            avgScore: { $avg: '$teacherScore' },
            avgDiff: { $avg: '$scoreDiff' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      return {
        teacherScoreCount,
        cloudApiScoreCount,
        autoGradingResultCount,
        totalRecords: teacherScoreCount + cloudApiScoreCount + autoGradingResultCount,
        recentTeacherScores,
        testStats,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('获取训练数据统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取训练数据历史记录
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 查询结果
   */
  async getTrainingData(options = {}) {
    try {
      const { page = 1, limit = 20, type = 'all' } = options;
      const skip = (page - 1) * limit;
      
      let data;
      let total;
      
      // 根据类型查询不同的集合
      if (type === 'teacher' || type === 'all') {
        const teacherScores = await this.TeacherScore.find()
          .sort({ timestamp: -1 })
          .skip(type === 'all' ? 0 : skip)
          .limit(type === 'all' ? 10 : limit)
          .lean();
          
        const teacherTotal = await this.TeacherScore.countDocuments();
        
        if (type === 'teacher') {
          data = teacherScores;
          total = teacherTotal;
        } else {
          data = { teacherScores };
        }
      }
      
      if (type === 'cloud' || type === 'all') {
        const cloudScores = await this.CloudApiScore.find()
          .sort({ timestamp: -1 })
          .skip(type === 'all' ? 0 : skip)
          .limit(type === 'all' ? 10 : limit)
          .lean();
          
        const cloudTotal = await this.CloudApiScore.countDocuments();
        
        if (type === 'cloud') {
          data = cloudScores;
          total = cloudTotal;
        } else if (type === 'all') {
          data = { ...(data || {}), cloudScores };
        }
      }
      
      if (type === 'auto' || type === 'all') {
        const autoResults = await this.AutoGradingResult.find()
          .sort({ timestamp: -1 })
          .skip(type === 'all' ? 0 : skip)
          .limit(type === 'all' ? 10 : limit)
          .lean();
          
        const autoTotal = await this.AutoGradingResult.countDocuments();
        
        if (type === 'auto') {
          data = autoResults;
          total = autoTotal;
        } else if (type === 'all') {
          data = { ...(data || {}), autoResults };
        }
      }
      
      if (type === 'all') {
        // 计算所有集合的总记录数
        total = await this.getTotalRecordCount();
      }
      
      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('获取训练数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取总记录数
   * @returns {Promise<number>} 总记录数
   */
  async getTotalRecordCount() {
    try {
      const [teacherCount, cloudCount, autoCount] = await Promise.all([
        this.TeacherScore.countDocuments(),
        this.CloudApiScore.countDocuments(),
        this.AutoGradingResult.countDocuments()
      ]);
      
      return teacherCount + cloudCount + autoCount;
    } catch (error) {
      console.error('获取总记录数失败:', error);
      throw error;
    }
  }

  /**
   * 导出所有训练数据
   * @returns {Promise<Object>} 所有训练数据
   */
  async exportAllData() {
    try {
      const [teacherScores, cloudApiScores, autoGradingResults] = await Promise.all([
        this.TeacherScore.find().lean(),
        this.CloudApiScore.find().lean(),
        this.AutoGradingResult.find().lean()
      ]);
      
      return {
        exportDate: new Date().toISOString(),
        teacherScores,
        cloudApiScores,
        autoGradingResults,
        metadata: {
          teacherScoreCount: teacherScores.length,
          cloudApiScoreCount: cloudApiScores.length,
          autoGradingResultCount: autoGradingResults.length,
          totalRecords: teacherScores.length + cloudApiScores.length + autoGradingResults.length
        }
      };
    } catch (error) {
      console.error('导出训练数据失败:', error);
      throw error;
    }
  }

  /**
   * 导入训练数据
   * @param {Object} data - 要导入的数据
   * @returns {Promise<Object>} 导入结果
   */
  async importData(data) {
    try {
      const results = {
        teacherScores: { success: 0, error: 0 },
        cloudApiScores: { success: 0, error: 0 },
        autoGradingResults: { success: 0, error: 0 }
      };
      
      // 导入教师评分数据
      if (data.teacherScores && Array.isArray(data.teacherScores)) {
        for (const score of data.teacherScores) {
          try {
            // 添加来源标记
            const scoreWithSource = { ...score, source: 'import' };
            
            // 检查是否已存在相同记录
            const exists = await this.TeacherScore.findOne({
              testName: score.testName,
              teacherScore: score.teacherScore,
              'studentResponse._id': score.studentResponse?._id
            });
            
            if (!exists) {
              await this.TeacherScore.create(scoreWithSource);
              results.teacherScores.success++;
            }
          } catch (err) {
            console.error('导入教师评分失败:', err);
            results.teacherScores.error++;
          }
        }
      }
      
      // 导入云API评分数据
      if (data.cloudApiScores && Array.isArray(data.cloudApiScores)) {
        for (const score of data.cloudApiScores) {
          try {
            // 检查是否已存在相同记录
            const exists = await this.CloudApiScore.findOne({
              testName: score.testName,
              cloudScore: score.cloudScore,
              'studentResponse._id': score.studentResponse?._id
            });
            
            if (!exists) {
              await this.CloudApiScore.create(score);
              results.cloudApiScores.success++;
            }
          } catch (err) {
            console.error('导入云API评分失败:', err);
            results.cloudApiScores.error++;
          }
        }
      }
      
      // 导入自动评分结果
      if (data.autoGradingResults && Array.isArray(data.autoGradingResults)) {
        for (const result of data.autoGradingResults) {
          try {
            // 检查是否已存在相同记录
            const exists = await this.AutoGradingResult.findOne({
              testName: result.testName,
              finalScore: result.finalScore,
              'studentResponse._id': result.studentResponse?._id
            });
            
            if (!exists) {
              await this.AutoGradingResult.create(result);
              results.autoGradingResults.success++;
            }
          } catch (err) {
            console.error('导入自动评分结果失败:', err);
            results.autoGradingResults.error++;
          }
        }
      }
      
      const totalImported = results.teacherScores.success + 
                           results.cloudApiScores.success + 
                           results.autoGradingResults.success;
      
      return {
        success: true,
        results,
        totalImported,
        message: `成功导入 ${totalImported} 条记录`
      };
    } catch (error) {
      console.error('导入训练数据失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 查询特定测试的评分历史
   * @param {string} testName - 测试名称
   * @param {number} limit - 返回记录数量限制
   * @returns {Promise<Object>} 评分历史
   */
  async getTestScoreHistory(testName, limit = 50) {
    try {
      const [teacherScores, autoResults] = await Promise.all([
        this.TeacherScore.find({ testName })
          .sort({ timestamp: -1 })
          .limit(limit)
          .lean(),
        this.AutoGradingResult.find({ testName })
          .sort({ timestamp: -1 })
          .limit(limit)
          .lean()
      ]);
      
      // 计算教师评分与自动评分的平均差异
      let totalDiff = 0;
      let diffCount = 0;
      
      teacherScores.forEach(score => {
        if (score.autoScore !== undefined) {
          totalDiff += Math.abs(score.teacherScore - score.autoScore);
          diffCount++;
        }
      });
      
      const avgDiff = diffCount > 0 ? totalDiff / diffCount : 0;
      
      return {
        testName,
        teacherScores,
        autoResults,
        stats: {
          teacherScoreCount: teacherScores.length,
          autoResultCount: autoResults.length,
          avgDiff,
          accuracy: diffCount > 0 ? 100 - (avgDiff * 10) : 0  // 简单的准确度计算
        }
      };
    } catch (error) {
      console.error('获取测试评分历史失败:', error);
      throw error;
    }
  }

  /**
   * 按测试类型统计训练数据
   * @returns {Promise<Array>} 测试统计信息
   */
  async getTestTypeStats() {
    try {
      const teacherStats = await this.TeacherScore.aggregate([
        {
          $group: {
            _id: '$testName',
            count: { $sum: 1 },
            avgScore: { $avg: '$teacherScore' },
            avgDiff: { $avg: '$scoreDiff' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      const autoStats = await this.AutoGradingResult.aggregate([
        {
          $group: {
            _id: '$testName',
            count: { $sum: 1 },
            avgModelScore: { $avg: '$modelScore' },
            avgCloudScore: { $avg: '$cloudScore' },
            avgFinalScore: { $avg: '$finalScore' }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      // 合并统计信息
      const testNames = new Set([
        ...teacherStats.map(stat => stat._id),
        ...autoStats.map(stat => stat._id)
      ]);
      
      const combinedStats = Array.from(testNames).map(testName => {
        const teacherStat = teacherStats.find(stat => stat._id === testName) || { count: 0, avgScore: 0, avgDiff: 0 };
        const autoStat = autoStats.find(stat => stat._id === testName) || { count: 0, avgModelScore: 0, avgCloudScore: 0, avgFinalScore: 0 };
        
        return {
          testName,
          teacherScoreCount: teacherStat.count,
          autoScoreCount: autoStat.count,
          avgTeacherScore: teacherStat.avgScore,
          avgAutoScore: autoStat.avgFinalScore,
          avgScoreDiff: teacherStat.avgDiff,
          accuracy: teacherStat.avgDiff ? 100 - (teacherStat.avgDiff * 10) : null
        };
      });
      
      return combinedStats;
    } catch (error) {
      console.error('获取测试类型统计失败:', error);
      throw error;
    }
  }
}

module.exports = TrainingDataRepository;